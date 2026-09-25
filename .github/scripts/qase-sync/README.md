# Qase IDs

Tests are tied to Qase TestOps cases by wrapping them: `qase(<id>, it('<title>', ...))`.
The `describe`/`context` titles map 1:1 to the Qase suite tree and the `it` title to the case
title, so a test is identified by its suite path plus its title.

`.github/scripts/qase-sync/qase-sync.mjs` compares the specs under `tests/cypress/latest/e2e`
(the `legacy/` sub-folder is skipped) against the live Qase project and reports:

* **stale** — `qase(<id>, ...)` points at a case that no longer exists
* **missing** — an `it()` has no `qase(...)` wrapper
* **duplicate** — two tests carry the same `qase(<id>, ...)`, so one of them has to move
* **qase-only** — a Qase case that no local test claims
* **mismatched** — the ID resolves, but the case's title or suite path no longer matches the test

Run it from the repository root:

```
(cd .github/scripts/qase-sync && npm install)
export QASE_API_TOKEN=<your token>
export QASE_PROJECT_CODE=RT
node .github/scripts/qase-sync/qase-sync.mjs          # report only; exits 1 if there is drift
node .github/scripts/qase-sync/qase-sync.mjs --fix    # repair stale IDs and insert missing ones
```

Only the first three are repaired by `--fix`, and only when exactly one unclaimed Qase case
matches the test's suite path and title; anything ambiguous is reported for you to resolve.
Qase-only cases always need a human — they are either a test that was never automated or a
duplicate case that should be deleted in Qase.

A mismatch is only ever a warning and never fails the run: renaming a test or moving it between
`describe` blocks is a legitimate thing to do, and the ID still points at the right case. It is
printed so the drift is visible — either retitle the case in Qase or accept that the two sides
read differently.

When no case matches, the report lists every Qase case sharing the test's title, marked
`unclaimed` or `claimed by <file>:<line>` — an unclaimed one is almost always the case the test
should point at, with the suite spelled differently on one of the two sides.

Each test carries exactly one ID. Anything the script cannot read as a plain number — tests
generated inside a `forEach` loop, or a `qase(...)` whose ID is an expression — is listed under **needs manual review**
and left untouched; those entries do not fail the run.

It requires both `QASE_API_TOKEN` and `QASE_PROJECT_CODE`. Nothing runs on a PR:
`.github/workflows/qase-id-check.yaml` runs it monthly (the 1st at 06:00 UTC) and on manual
dispatch, commits whatever `--fix` repaired onto `qase-sync-ids-<branch>` and opens a PR against
the branch it ran on. That job then fails if any ID was left for a human, so a red monthly run
means the report needs reading.
