#!/usr/bin/env node
/*
Keeps the Qase IDs in the Cypress e2e specs in sync with the Qase project.

Reports, and optionally fixes, four kinds of drift between the specs directly
under tests/cypress/latest/e2e (sub-folders, legacy/ among them, are not read)
and Qase TestOps:

  stale     qase(<id>, ...) points at a case that no longer exists
  missing   an it() has no qase(...) wrapper at all
  duplicate two tests carry the same qase(<id>, ...), so one of them has to move
  qase-only a Qase case that no local test claims

Local tests match Qase cases on the suite path plus the test title:
describe()/context() titles map 1:1 to the Qase suite tree, and the it() title
maps to the case title.

Usage:
    QASE_API_TOKEN=... node qase-sync.mjs           # report
    QASE_API_TOKEN=... node qase-sync.mjs --fix     # report and rewrite

Reads QASE_API_TOKEN and QASE_PROJECT_CODE from the environment; both are required.

Exit codes: 0 clean, 1 needs a human, 2 error.

Everything a person has to act on counts towards the exit code: stale, missing
and duplicate, which this script can repair, plus the manual-review list, which
it cannot. Under --fix the first three drop out once they are rewritten, so a
clean run ends at 0 while an unreadable loop or computed ID keeps it at 1.

qase-only cases and title/suite mismatches never fail the run: a case with no
local test, or a test that was legitimately renamed, is not something a change
to the specs would resolve.
*/

import {existsSync, readdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Node, Project, SyntaxKind} from 'ts-morph';

const QASE_API = 'https://api.qase.io/v1';
const PAGE_SIZE = 100;

// Anchored to this file - <repo>/.github/scripts/qase-sync/qase-sync.mjs - so the
// script runs the same from the repo root, from here via `npm run`, or from CI.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SPEC_DIR = join(REPO_ROOT, 'tests', 'cypress', 'latest', 'e2e');

const IT_NAMES = new Set(['it', 'xit']);
const SUITE_NAMES = new Set(['describe', 'context', 'xdescribe', 'xcontext']);

// --------------------------------------------------------------------------- //
// Qase API
// --------------------------------------------------------------------------- //

/** Fetch every entity of a kind ('suite' or 'case') for a project. */
async function qaseFetchAll(kind, project, token) {
  const entities = [];
  let total = null;
  for (let offset = 0; ;) {
    const url = `${QASE_API}/${kind}/${project}?limit=${PAGE_SIZE}&offset=${offset}`;
    const response = await fetch(url, {headers: {Token: token}});
    if (!response.ok) {
      throw new Error(`Qase API ${url} returned ${response.status}: ${await response.text()}`);
    }
    const payload = await response.json();
    if (!payload.status) throw new Error(`Qase API ${url} failed: ${JSON.stringify(payload)}`);
    const batch = payload.result.entities ?? [];
    entities.push(...batch);
    if (total === null) total = payload.result.total ?? null;
    offset += batch.length;
    if (total !== null && offset >= total) return entities;
    if (batch.length > 0) continue;

    // A short page before the reported total means the fetch was truncated.
    // Comparing against half a project invents both stale IDs and orphaned
    // cases, so refuse rather than report nonsense.
    if (total === null) return entities;
    throw new Error(`Qase API ${kind} returned ${entities.length} of ${total} reported entities`);
  }
}

/** suite id -> array of titles, from the root suite down to that suite. */
function buildSuitePaths(suites) {
  const byId = new Map(suites.map((suite) => [suite.id, suite]));
  const paths = new Map();
  const resolvePath = (id, seen) => {
    if (paths.has(id)) return paths.get(id);
    const suite = byId.get(id);
    const parent = suite.parent_id;
    const prefix = byId.has(parent) && !seen.has(id) ? resolvePath(parent, new Set([...seen, id])) : [];
    const path = [...prefix, suite.title];
    paths.set(id, path);
    return path;
  };
  for (const id of byId.keys()) resolvePath(id, new Set());
  return paths;
}

// --------------------------------------------------------------------------- //
// Reading the specs
//
// Only literal titles and IDs are understood. Anything computed - the three
// forEach loops that generate tests - is handed back to the user instead.
// --------------------------------------------------------------------------- //

/** A string literal's value, or null if the title is not a plain literal. */
function literalTitle(node) {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralValue();
  }
  return null;
}

/** The case ID a qase() call declares, or null if it is not a plain number. */
function literalId(node) {
  return Node.isNumericLiteral(node) ? node.getLiteralValue() : null;
}

/**
 * Every number under a node, ignoring array indexes such as `qaseID[0]`.
 *
 * Used to claim the cases named by an expression we cannot otherwise read, so
 * they are not reported as orphans.
 */
function numericLiterals(node) {
  const literals = node.getDescendantsOfKind(SyntaxKind.NumericLiteral);
  if (Node.isNumericLiteral(node)) literals.push(node);
  return literals
    .filter((literal) => !Node.isElementAccessExpression(literal.getParent()))
    .map((literal) => literal.getLiteralValue());
}

/**
 * True when a callee resolves to one of `names`, seeing through the `.skip` /
 * `.only` suffixes and the `(cond ? it.skip : it)` form the specs use.
 */
function isCalleeNamed(node, names) {
  if (Node.isIdentifier(node)) return names.has(node.getText());
  if (Node.isPropertyAccessExpression(node)) return isCalleeNamed(node.getExpression(), names);
  if (Node.isParenthesizedExpression(node)) return isCalleeNamed(node.getExpression(), names);
  if (Node.isConditionalExpression(node)) {
    return isCalleeNamed(node.getWhenTrue(), names) || isCalleeNamed(node.getWhenFalse(), names);
  }
  return false;
}

/** True for `it`, `xit`, `it.skip` and `(cond ? it.skip : it)`. */
const isItCallee = (node) => isCalleeNamed(node, IT_NAMES);

/** True for `describe`, `context` and their `x`-prefixed and `.skip`/`.only` forms. */
const isSuiteCallee = (node) => isCalleeNamed(node, SUITE_NAMES);

function isCallTo(node, names) {
  if (!Node.isCallExpression(node)) return false;
  const callee = node.getExpression();
  return Node.isIdentifier(callee) && names.has(callee.getText());
}

/** The `{ ... }` body of the last arrow-function argument of a call. */
function arrowBody(call) {
  for (const argument of [...call.getArguments()].reverse()) {
    if (Node.isArrowFunction(argument) || Node.isFunctionExpression(argument)) {
      const body = argument.getBody();
      if (Node.isBlock(body)) return body;
    }
  }
  return null;
}

/** Leading whitespace of the line a node starts on. */
function indentOf(node) {
  const text = node.getSourceFile().getFullText();
  const lineStart = text.lastIndexOf('\n', node.getStart()) + 1;
  return text.slice(lineStart, node.getStart()).match(/^\s*/)[0];
}

/**
 * Walk one spec file.
 *
 * Returns the tests it could read, the loops it refused to read, and the IDs
 * harvested from those loops so their Qase cases are not reported as orphans.
 */
function readSpec(sourceFile, file) {
  const tests = [];
  const manual = [];
  const harvested = new Set();

  /** Record a test, given the call that declares it. */
  const record = (itCall, idNode, suite) => {
    const line = itCall.getStartLineNumber();
    const id = idNode ? literalId(idNode) : null;

    // Already wrapped, but the ID is computed: we can neither check nor repair
    // it. Claim whatever numbers it mentions so the cases are not reported as
    // orphans, and leave the call itself alone - re-wrapping it would be wrong.
    if (idNode && id === null) {
      const ids = numericLiterals(idNode);
      ids.forEach((value) => harvested.add(value));
      manual.push({file, line, suite, ids, note: 'qase() ID is not a plain number'});
      return;
    }

    const [titleArg] = itCall.getArguments();
    const statement = itCall.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
    tests.push({
      file,
      line,
      suite,
      title: titleArg ? literalTitle(titleArg) : null,
      id,
      idSpan: idNode ? [idNode.getStart(), idNode.getEnd()] : null,
      itSpan: [itCall.getStart(), itCall.getEnd()],
      statementSpan: statement ? [statement.getStart(), statement.getEnd()] : null,
      indent: indentOf(statement ?? itCall),
    });
  };

  const walk = (node, suite) => {
    for (const child of node.getChildren()) {
      // describe(...) / context(...): descend with the suite path extended.
      if (Node.isCallExpression(child) && isSuiteCallee(child.getExpression())) {
        const [titleArg] = child.getArguments();
        const body = arrowBody(child);
        if (body) walk(body, [...suite, titleArg ? literalTitle(titleArg) ?? titleArg.getText() : '?']);
        continue;
      }

      // x.forEach(...): generates tests we cannot read statically.
      if (Node.isCallExpression(child)
          && Node.isPropertyAccessExpression(child.getExpression())
          && child.getExpression().getName() === 'forEach'
          && arrowBody(child)) {
        const ids = harvestLoopIds(child);
        ids.forEach((id) => harvested.add(id));
        manual.push({
          file, line: child.getStartLineNumber(), suite, ids,
          note: 'tests generated in a forEach loop',
        });
        continue;
      }

      // qase(<id>, it(...)) - and the qase(<id>, <callee>)('title', ...) variant,
      // where the qase call is itself the callee of the test call.
      if (isCallTo(child, new Set(['qase']))) {
        const [idNode, wrapped] = child.getArguments();
        const parent = child.getParent();
        const itCall = Node.isCallExpression(parent) && parent.getExpression() === child
          ? parent
          : (wrapped && Node.isCallExpression(wrapped) && isItCallee(wrapped.getExpression()) ? wrapped : null);
        if (itCall) {
          record(itCall, idNode, suite);
          continue;
        }
      }

      // A bare it(...) with no wrapper.
      if (Node.isCallExpression(child) && isItCallee(child.getExpression())) {
        record(child, null, suite);
        continue;
      }

      walk(child, suite);
    }
  };

  walk(sourceFile, []);
  return {tests, manual, harvested};
}

/**
 * The numbers in an `Object.entries({...})` / `Object.values({...})` receiver.
 *
 * Nothing else counts as a table of IDs. A loop over plain numbers - say
 * `[3, 153].forEach(...)` - looks identical to one, and claiming its values
 * would hide those cases from the report; over-reporting them is the safer way
 * to be wrong.
 */
function idTableLiterals(receiver) {
  if (!Node.isCallExpression(receiver)) return [];
  const callee = receiver.getExpression();
  if (!Node.isPropertyAccessExpression(callee)) return [];
  if (callee.getExpression().getText() !== 'Object') return [];
  if (!['entries', 'values'].includes(callee.getName())) return [];
  const [table] = receiver.getArguments();
  return table ? numericLiterals(table) : [];
}

/**
 * Qase IDs mentioned by a loop we are skipping.
 *
 * Two sources are trusted: the first argument of a qase() call inside the loop,
 * and the ID table it iterates over - that is where the IDs live when the call
 * site reads `qase(qaseID[0], ...)`.
 */
function harvestLoopIds(forEachCall) {
  const ids = new Set(idTableLiterals(forEachCall.getExpression().getExpression()));
  for (const call of forEachCall.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (!isCallTo(call, new Set(['qase']))) continue;
    const [idNode] = call.getArguments();
    if (idNode) numericLiterals(idNode).forEach((id) => ids.add(id));
  }
  return [...ids];
}

// --------------------------------------------------------------------------- //
// Comparison
// --------------------------------------------------------------------------- //

const samePath = (a, b) => a.length === b.length && a.every((part, i) => part === b[i]);
const locationKey = (suite, title) => `${suite.join(' › ')}\u0000${title}`;

function compare(tests, cases, suitePaths, harvested) {
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const byLocation = new Map();
  const byTitle = new Map();
  for (const entry of cases) {
    const key = locationKey(suitePaths.get(entry.suite_id) ?? [], entry.title);
    if (!byLocation.has(key)) byLocation.set(key, []);
    byLocation.get(key).push(entry.id);
    if (!byTitle.has(entry.title)) byTitle.set(entry.title, []);
    byTitle.get(entry.title).push(entry.id);
  }

  const claimed = new Map();
  const stale = [];
  const missing = [];
  const duplicate = [];
  const mismatched = [];

  // Pass 1: honour every ID that still exists, so a repair can never steal it.
  for (const test of tests) {
    if (test.id !== null && caseById.has(test.id) && !claimed.has(test.id)) claimed.set(test.id, test);
  }
  for (const id of harvested) {
    if (caseById.has(id) && !claimed.has(id)) claimed.set(id, 'loop');
  }

  /**
   * The Qase case a test should point at, or the reason there isn't one.
   *
   * When the lookup fails, `candidates` carries the cases worth looking at by
   * hand: the ones at this exact location if any exist, otherwise every case
   * sharing the title, since a case that moved suite is still the same case.
   */
  const findReplacement = (test) => {
    if (test.title === null) {
      return {id: null, reason: 'title is not a plain string literal', candidates: []};
    }
    const all = byLocation.get(locationKey(test.suite, test.title)) ?? [];
    const free = all.filter((id) => !claimed.has(id));
    if (free.length === 1) return {id: free[0], reason: null, candidates: []};
    if (free.length > 1) {
      return {id: null, reason: `ambiguous - ${free.length} Qase cases share this title`, candidates: free};
    }
    if (all.length) {
      return {id: null, reason: 'all matching Qase cases are already claimed', candidates: all};
    }
    const sameTitle = byTitle.get(test.title) ?? [];
    return {
      id: null,
      reason: sameTitle.length
        ? 'no Qase case at this suite path, but the title exists elsewhere'
        : 'no Qase case with this title anywhere',
      candidates: sameTitle,
    };
  };

  for (const test of tests) {
    // No wrapper at all, or one pointing at a case that no longer exists: both
    // need a replacement looked up by suite path and title.
    if (test.id === null || !caseById.has(test.id)) {
      const {id, reason, candidates} = findReplacement(test);
      if (id !== null) claimed.set(id, test);
      const bucket = test.id === null ? missing : stale;
      bucket.push({test, dead: test.id, proposed: id, reason, candidates});
      continue;
    }
    // The case exists, but pass 1 handed it to an earlier test - always a test
    // and never a loop, since literals are claimed before anything harvested.
    // Only one of the two can report results into it, so this one needs a
    // replacement of its own, exactly as a stale ID would.
    const owner = claimed.get(test.id);
    if (owner !== test) {
      const {id, reason, candidates} = findReplacement(test);
      if (id !== null) claimed.set(id, test);
      duplicate.push({test, dead: test.id, owner: `${owner.file}:${owner.line}`, proposed: id, reason, candidates});
      continue;
    }
    const entry = caseById.get(test.id);
    const suite = suitePaths.get(entry.suite_id) ?? [];
    if (test.title !== null && !(samePath(suite, test.suite) && entry.title === test.title)) {
      mismatched.push({test, caseId: test.id, qaseSuite: suite, qaseTitle: entry.title});
    }
  }

  // Only now is `claimed` final, so this is where a candidate can be told
  // "nobody wants me" - which is what makes it worth suggesting at all.
  const describeCandidate = (id) => {
    const entry = caseById.get(id);
    const owner = claimed.get(id);
    return {
      id,
      suite: suitePaths.get(entry.suite_id) ?? [],
      title: entry.title,
      claimedBy: owner === undefined ? null : (owner === 'loop' ? 'a forEach loop' : `${owner.file}:${owner.line}`),
    };
  };
  for (const item of [...stale, ...missing, ...duplicate]) item.candidates = item.candidates.map(describeCandidate);

  const qaseOnly = [];
  for (const entry of [...cases].sort((a, b) => a.id - b.id)) {
    if (!claimed.has(entry.id)) {
      qaseOnly.push({suite: suitePaths.get(entry.suite_id) ?? [], id: entry.id, title: entry.title});
    }
  }

  return {stale, missing, duplicate, mismatched, qaseOnly};
}

// --------------------------------------------------------------------------- //
// Fixing
// --------------------------------------------------------------------------- //

/** Rewrite the specs in place. Returns how much was applied and left behind. */
function applyFixes(sourceFiles, report) {
  const edits = new Map();
  let applied = 0;
  let skipped = 0;

  const queue = (file, span, text) => {
    if (!edits.has(file)) edits.set(file, []);
    edits.get(file).push({span, text});
    applied += 1;
  };

  // A stale or duplicated test always has a literal ID to overwrite; computed
  // ones never get this far, they are sent to the manual-review list while the
  // file is read.
  for (const item of [...report.stale, ...report.duplicate]) {
    if (item.proposed === null) skipped += 1;
    else queue(item.test.file, item.test.idSpan, String(item.proposed));
  }

  for (const item of report.missing) {
    const {test} = item;
    if (item.proposed === null || test.statementSpan === null) {
      skipped += 1;
      continue;
    }
    // Wrapping the whole statement keeps the trailing semicolon correct.
    const [start, end] = test.itSpan;
    const body = sourceFiles.get(test.file).getFullText().slice(start, end);
    queue(test.file, test.statementSpan, `qase(${item.proposed}, ${body}\n${test.indent});`);
  }

  for (const [file, fileEdits] of edits) {
    const sourceFile = sourceFiles.get(file);
    // Reverse order so earlier spans keep their offsets.
    for (const {span, text} of fileEdits.sort((a, b) => b.span[0] - a.span[0])) {
      sourceFile.replaceText(span, text);
    }
    sourceFile.saveSync();
  }

  return {applied, skipped};
}

// --------------------------------------------------------------------------- //
// Reporting
// --------------------------------------------------------------------------- //

const fmtSuite = (suite) => (suite.length ? suite.join(' > ') : '(no suite)');
const byLine = (a, b) => a.file.localeCompare(b.file) || a.line - b.line;

const MAX_CANDIDATES = 5;

/** Same-title Qase cases offered as a starting point when the lookup failed. */
function printCandidates(candidates) {
  if (!candidates.length) return;
  // Unclaimed first: those are the ones this test could actually be pointed at.
  const ordered = [...candidates].sort((a, b) => Number(!!a.claimedBy) - Number(!!b.claimedBy) || a.id - b.id);
  for (const entry of ordered.slice(0, MAX_CANDIDATES)) {
    const who = entry.claimedBy ? `claimed by ${entry.claimedBy}` : 'unclaimed - likely this one';
    console.log(`      candidate ${entry.id}: ${fmtSuite(entry.suite)} > '${entry.title}'  [${who}]`);
  }
  if (ordered.length > MAX_CANDIDATES) {
    console.log(`      ... and ${ordered.length - MAX_CANDIDATES} more with this title`);
  }
}

function printReport(report, manual, fixing) {
  const {stale, missing, duplicate, mismatched, qaseOnly} = report;

  console.log(`== Stale Qase IDs (${stale.length}) ==`);
  if (!stale.length) console.log('  none');
  for (const {test, dead, proposed, reason, candidates} of [...stale].sort((a, b) => byLine(a.test, b.test))) {
    const action = proposed === null
      ? `NO REPLACEMENT (${reason})`
      : (fixing ? `-> ${proposed}` : `should be ${proposed}`);
    console.log(`  ${test.file}:${test.line}  ${dead} ${action}`);
    console.log(`      ${fmtSuite(test.suite)} > '${test.title}'`);
    printCandidates(candidates);
  }
  console.log();

  console.log(`== Tests with no Qase ID (${missing.length}) ==`);
  if (!missing.length) console.log('  none');
  for (const {test, proposed, reason, candidates} of [...missing].sort((a, b) => byLine(a.test, b.test))) {
    const action = proposed === null
      ? `NO MATCH (${reason}) - create the case in Qase`
      : `add qase(${proposed})`;
    console.log(`  ${test.file}:${test.line}  ${action}`);
    console.log(`      ${fmtSuite(test.suite)} > '${test.title}'`);
    printCandidates(candidates);
  }
  console.log();

  console.log(`== Qase IDs claimed by more than one test (${duplicate.length}) ==`);
  if (!duplicate.length) console.log('  none');
  for (const {test, dead, owner, proposed, reason, candidates} of [...duplicate].sort((a, b) => byLine(a.test, b.test))) {
    const action = proposed === null
      ? `NO REPLACEMENT (${reason})`
      : (fixing ? `-> ${proposed}` : `should be ${proposed}`);
    console.log(`  ${test.file}:${test.line}  ${dead} is already used by ${owner}, ${action}`);
    console.log(`      ${fmtSuite(test.suite)} > '${test.title}'`);
    printCandidates(candidates);
  }
  console.log();

  console.log(`== Qase cases not present locally (${qaseOnly.length}) ==`);
  if (!qaseOnly.length) console.log('  none');
  let lastSuite = null;
  for (const entry of [...qaseOnly].sort((a, b) => fmtSuite(a.suite).localeCompare(fmtSuite(b.suite)) || a.id - b.id)) {
    const suite = fmtSuite(entry.suite);
    if (suite !== lastSuite) {
      console.log(`  ${suite}`);
      lastSuite = suite;
    }
    console.log(`    ${String(entry.id).padStart(4)}  '${entry.title}'`);
  }
  console.log();

  console.log(`== Warning: ID exists but title/suite differs (${mismatched.length}) ==`);
  if (!mismatched.length) console.log('  none');
  for (const item of [...mismatched].sort((a, b) => byLine(a.test, b.test))) {
    console.log(`  ${item.test.file}:${item.test.line}  qase(${item.caseId})`);
    console.log(`      local: ${fmtSuite(item.test.suite)} > '${item.test.title}'`);
    console.log(`      qase:  ${fmtSuite(item.qaseSuite)} > '${item.qaseTitle}'`);
  }
  console.log();

  console.log(`== Needs manual review (${manual.length}) ==`);
  if (!manual.length) console.log('  none');
  for (const entry of [...manual].sort(byLine)) {
    console.log(`  ${entry.file}:${entry.line}  ${entry.note}`);
    console.log(`      ${fmtSuite(entry.suite)}; assuming it references ${entry.ids.sort((a, b) => a - b).join(', ') || 'no IDs'}`);
  }
  console.log();
}

// --------------------------------------------------------------------------- //

function usage(log) {
  log('usage: node qase-sync.mjs [--fix]');
  log('       --fix   repair stale IDs and insert missing ones, in place');
  log('       run with no flags to report only; exits 1 if anything needs a human');
  log('env:   QASE_API_TOKEN, QASE_PROJECT_CODE (both required)');
  log('note:  via npm the flag needs a separator - npm run qase-sync -- --fix');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    usage(console.log);
    return 0;
  }

  // --fix is the only other flag. Still reject anything unrecognised rather than
  // ignoring it: a silently dropped `--fx` would look like a clean report
  // instead of a repair.
  const unknown = args.filter((arg) => arg !== '--fix');
  if (unknown.length) {
    console.error(`unexpected argument(s): ${unknown.join(' ')}`);
    usage(console.error);
    return 2;
  }
  const fix = args.includes('--fix');

  const token = process.env.QASE_API_TOKEN;
  if (!token) {
    console.error('QASE_API_TOKEN is not set');
    return 2;
  }
  const projectId = process.env.QASE_PROJECT_CODE;
  if (!projectId) {
    console.error('QASE_PROJECT_CODE is not set');
    return 2;
  }
  const specDir = SPEC_DIR;
  if (!existsSync(specDir)) {
    console.error(`spec dir not found: ${specDir}`);
    return 2;
  }

  let suites;
  let cases;
  try {
    [suites, cases] = await Promise.all([
      qaseFetchAll('suite', projectId, token),
      qaseFetchAll('case', projectId, token),
    ]);
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  const suitePaths = buildSuitePaths(suites);

  // skipAddingFilesFromTsConfig keeps this to just the specs; nothing is type-checked.
  const project = new Project({useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true});
  const sourceFiles = new Map();
  const tests = [];
  const manual = [];
  const harvested = new Set();

  for (const name of readdirSync(specDir).sort()) {
    if (!name.endsWith('.spec.ts')) continue;
    const sourceFile = project.addSourceFileAtPath(join(specDir, name));
    sourceFiles.set(name, sourceFile);
    const found = readSpec(sourceFile, name);
    tests.push(...found.tests);
    manual.push(...found.manual);
    found.harvested.forEach((id) => harvested.add(id));
  }

  const report = compare(tests, cases, suitePaths, harvested);

  console.log(`Qase project ${projectId}: ${suites.length} suites, ${cases.length} cases`);
  console.log(`Local specs: ${tests.length} tests across ${specDir}\n`);
  printReport(report, manual, fix);

  if (fix) {
    const {applied, skipped} = applyFixes(sourceFiles, report);
    console.error(
      `Applied ${applied} fix(es); ${skipped} could not be repaired, ${manual.length} need manual review.`,
    );
    return skipped === 0 && manual.length === 0 ? 0 : 1;
  }

  const drift = report.stale.length > 0 || report.missing.length > 0 || report.duplicate.length > 0;
  return drift || manual.length > 0 ? 1 : 0;
}

// Exit 1 has to mean "a human is needed" and nothing else: CI reads it as a soft
// failure it can still open a PR from. A crash must not be mistaken for it.
process.exitCode = await main().catch((error) => {
  console.error(error?.stack ?? error);
  return 2;
});
