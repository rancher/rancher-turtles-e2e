/*
Copyright © 2022 - 2023 SUSE LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import './commands';
import './capz_support';
import './cleanup_support';
import {ChartInstallExtraOptions, Cluster, EditKubernetesResourceOptions} from './structs';
import {register as registerCypressGrep} from '@cypress/grep'
import {qase} from 'cypress-qase-reporter/mocha';

// This ensures the qase() function exists globally before ANY spec file loads
(window as any).qase = qase;
console.log('Qase global initialized');

declare global {
  namespace Cypress {
    interface Chainable {
      // Functions declared in commands.ts
      namespaceAutoImport(mode: string): Chainable<Element>;
      setAutoImport(mode: string): Chainable<Element>;
      clusterAutoImport(clusterName: string, mode: string): Chainable<Element>;
      addFleetGitRepo(repoName: string, repoUrl: string, branch: string, paths: string | string[], targetNamespace?: string, workspace?: string): Chainable<Element>;
      removeFleetGitRepo(repoName: string, workspace?: string): Chainable<Element>;
      forceUpdateFleetGitRepo(repoName: string, workspace?: string): Chainable<Element>;
      goToFleetGitRepos(workspace?: string): Chainable<Element>;
      checkFleetGitRepoActive(repoName: string, workspace?: string): Chainable<Element>;
      fleetNamespaceToggle(toggleOption: string): Chainable<Element>;
      verifyTableRow(rowNumber: number, expectedText1?: string | RegExp, expectedText2?: string | RegExp): Chainable<Element>;

      waitForAllRowsInState(desiredState: string, timeout?: number): Chainable<Element>;
      accesMenuSelection(menuPaths: string[]): Chainable<Element>;
      burgerMenuOperate(operation: 'open' | 'close'): Chainable<Element>;

      checkChart(clusterName: string, operation: string, chartName: string, namespace: string, options?: ChartInstallExtraOptions): Chainable<Element>;

      deleteCluster(clusterName: string, timeout?: number): Chainable<Element>;
      searchCluster(clusterName: string): Chainable<Element>;
      createNamespace(namespaces: string[]): Chainable<Element>;
      deleteNamespace(namespaces: string[]): Chainable<Element>;
      setNamespace(namespace: string, namespaceID?: string): Chainable<Element>;

      createCAPICluster(cluster: Cluster): Chainable<Element>;
      checkCAPICluster(clustername: string): Chainable<Element>;
      checkCAPIClusterClass(classname: string): Chainable<Element>;

      checkCAPIClusterActive(clustername: string, timeout?: number, skipMDCheck?: boolean): Chainable<Element>; // skipMDCheck is required while using MachinePools, in case of GKE
      checkCAPIClusterProvisioned(clustername: string, timeout?: number): Chainable<Element>;
      checkCAPIClusterDeleted(clustername: string, timeout: number): Chainable<Element>;
      checkCAPIMenu(): Chainable<Element>;
      checkFleetHelmOps(appList: string[]): Chainable<Element>;
      namespaceReset(): Chainable<Element>;
      performDelete(): Chainable<Element>;
      navigateToProviders(): Chainable<Element>;
      addCustomProvider(name: string, namespace: string, providerName: string, providerType: string, version?: string, url?: string): Chainable<Element>;
      addInfraProvider(providerType: string, namespace: string, cloudCredentials?: string): Chainable<Element>;
      removeCAPIResource(resourceType: string, resourceName: string, timeout?: number): Chainable<Element>;
      addCloudCredsAWS(name: string, accessKey: string, secretKey: string): Chainable<Element>;
      deleteCloudCredsAWS(name: string): Chainable<Element>;
      addCloudCredsGCP(name: string, gcpCredentials: string): Chainable<Element>;
      addCloudCredsAzure(name: string, clientID: string, clientSecret: string, subscriptionID: string): Chainable<Element>;
      addCloudCredsVMware(name: string, vsphere_username: string, vsphere_password: string, vsphere_server: string, vsphere_server_port: string): Chainable<Element>;

      addRepository(repositoryName: string, repositoryURL: string, repositoryType: 'oci' | 'http' | 'git', repositoryBranch: string): Chainable<Element>;

      typeInFilter(text: string, selector?: string): Chainable<Element>;
      goToHome(): Chainable<Element>;
      patchYamlResource(clusterName: string, namespace: string, resourceKind: string, resourceName: string, patch: object): Chainable<Element>;
      importYAML(yamlOrPath: string, namespace?: string, clusterName?: string): Chainable<Element>;
      verifyResourceCount(clusterName: string, resourcePath: string[], resourceName: string, namespace: string, expectedCount: number, timeout?: number): Chainable<Element>;
      exploreCluster(clusterName: string): Chainable<Element>;
      createVSphereClusterIdentity(vsphere_username: string, vsphere_password: string): Chainable<Element>;
      createAWSClusterStaticIdentity(accessKey: string, secretKey: string): Chainable<Element>;
      checkAWSClusterStaticIdentity(): Chainable<Element>;
      createCAPIProvider(providerName: string): Chainable<Element>;
      checkCAPIProvider(providerName: string): Chainable<Element>;
      verifyCAPIProviderImage(providerNamespace: string): Chainable<Element>;
      setCAPIFeature(featureName: string, featureValue: string): Chainable<Element>;
      createDockerAuthSecret(): Chainable<Element>;
      checkExternalFleetAnnotation(clustername: string, required?: boolean): Chainable<Element>;
      viewCAPIClusterYAML(clustername: string): Chainable<Element>;
      checkCAPIClusterCPInitialized(clustername: string): Chainable<Element>;
      kubectlExecute(commands: string[], timeout?: number): Chainable<Element>;
      filterPodErrorLogs(podName: string): Chainable<Element>;
      checkAppDeployed(appName: string, namespace: string, chartVersion: string): Chainable<Element>;
      checkYAMLText(content: string, shouldExist: boolean): Chainable<Element>;
      // Functions declared in capz_support.js
      createAzureClusterIdentity(clientID: string, tenantID: string, clientSecret: string): Chainable<Element>;
      createAzureASOCredential(clientID: string, tenantID: string, clientSecret: string, subscriptionID: string): Chainable<Element>;
      deleteKubernetesResource(clusterName: string, resourcePath: string[], resourceName: string, namespace?: string): Chainable<Element>;

      editKubernetesResource(options: EditKubernetesResourceOptions): Chainable<Element>;
      checkKubernetesResource(clusterName: string, resourcePath: string[], resourceName: string, shouldExist: boolean, namespace: string, timeout?: number): Chainable<Element>;
    }
  }
}

// TODO handle redirection errors better?
// we see a lot of 'error navigation cancelled' uncaught exceptions that don't actually break anything; ignore them here
Cypress.on('uncaught:exception', (err, runnable, promise) => {
  // returning false here prevents Cypress from failing the test
  if (err.message.includes('navigation guard')) {
    return false;
  }
  if (err.message.includes('on cross-origin object')) {
    return false;
  }
  if (promise) {
    return false;
  }
  // Workaround for capi-ui-extension/issues/124
  // returning false here prevents Cypress from
  // failing the test
  return false
});

require('cy-verify-downloads').addCustomCommand();
require('cypress-plugin-tab');
require('@rancher-ecp-qa/cypress-library');
registerCypressGrep()

// Fail-fast rules (CI only):
//  1. An @install test fails (after all retries)  -> skip every remaining test in every spec
//  2. A [SETUP] test fails (after all retries)     -> skip the rest of the spec
//  3. A [CLUSTER-IMPORT] test fails (after retries) -> skip the rest of the spec except [TEARDOWN] tests
// State (runAborted) is kept in memory only: the run-wide flag lives in the Node process (see cypress.config.ts tasks),
// and the per-spec mode (specMode) below resets automatically because the support file is re-evaluated for every spec.
const isCI = String(Cypress.expose('ci')).toLowerCase() === "true";
let specMode: 'skip-all' | 'teardown-only' | undefined;  // undefined = no failure yet, run tests normally

// Rule 1 (cross-spec): an @install test failed in an earlier spec - skip this whole spec
before(function () {
  if (!isCI) return;
  cy.task('isRunAborted').then((aborted) => {
    if (aborted) {
      cy.task('suiteLog', 'An @install test has failed earlier in this run - skipping spec.');
      this.skip();
    }
  });
});

// Rules 1-3 (within the spec)
beforeEach(function () {
  if (!isCI) return;

  if (specMode === 'skip-all') {
    this.skip();
  } else if (specMode === 'teardown-only') {
    if (this.currentTest!.fullTitle().includes('[TEARDOWN]')) {
      cy.task('suiteLog', 'A [CLUSTER-IMPORT] test has failed - running [TEARDOWN] test for a proper cleanup.');
    } else {
      this.skip();
    }
  }
});

// Decide the mode only once a test has failed its final attempt, so retries are not skipped
afterEach(function () {
  if (!isCI) return;

  // currentTest is always set in beforeEach/afterEach; `!` only satisfies the Mocha typings
  const test = this.currentTest;
  const finalAttempt = Cypress.currentRetry == (Cypress.getTestRetries() || 0);
  if (!test || test.state !== 'failed' || !finalAttempt) return;

  const title = test.fullTitle();
  if (title.includes('@install')) {
    specMode = 'skip-all';
    cy.task('markRunAborted');
    cy.task('suiteLog', `@install test "${title}" has failed - skipping all remaining tests.`);
  } else if (title.includes('[SETUP]')) {
    specMode = 'skip-all';
    cy.task('suiteLog', `[SETUP] test "${title}" has failed - skipping rest of the spec.`);
  } else if (title.includes('[CLUSTER-IMPORT]')) {
    specMode = 'teardown-only';
    cy.task('suiteLog', `[CLUSTER-IMPORT] test "${title}" has failed - skipping rest of the spec except [TEARDOWN] tests.`);
  }
});
