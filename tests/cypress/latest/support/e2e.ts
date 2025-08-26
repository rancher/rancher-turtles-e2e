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
import yaml from 'js-yaml';
import './capz_support';
import './cleanup_support';
import {Cluster, Question} from './structs';
// @ts-expect-error ignore the error
import registerCypressGrep from '@cypress/grep'

declare global {
  // In Cypress functions should be declared with 'namespace'
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      // Functions declared in commands.ts
      namespaceAutoImport(mode: string): Chainable<Element>;
      setAutoImport(mode: string): Chainable<Element>;
      clusterAutoImport(clusterName: string, mode: string): Chainable<Element>;
      addFleetGitRepo(repoName: string, repoUrl: string, branch: string, paths: string | string[], targetNamespace?: string, workspace?: string): Chainable<Element>;
      removeFleetGitRepo(repoName: string, workspace?: string): Chainable<Element>;
      forceUpdateFleetGitRepo(repoName: string, workspace?: string): Chainable<Element>;
      checkFleetGitRepo(repoName: string, workspace?: string): Chainable<Element>;
      fleetNamespaceToggle(toggleOption: string): Chainable<Element>;
      verifyTableRow(rowNumber: number, expectedText1?: string | RegExp, expectedText2?: string | RegExp): Chainable<Element>;
      waitForAllRowsInState(desiredState: string, timeout?: number): Chainable<Element>;
      accesMenuSelection(menuPaths: string[]): Chainable<Element>;
      burgerMenuOperate(operation: 'open' | 'close'): Chainable<Element>;
      checkChart(operation: string, chartName: string, namespace: string, version?: string, questions?: Question[], refreshRepo?: boolean): Chainable<Element>;

      deleteCluster(clusterName: string, timeout?: number): Chainable<Element>;
      searchCluster(clusterName: string): Chainable<Element>;
      createNamespace(namespace: string): Chainable<Element>;
      setNamespace(namespace: string, namespaceID?: string): Chainable<Element>;

      createCAPICluster(cluster: Cluster): Chainable<Element>;
      checkCAPICluster(clustername: string): Chainable<Element>;
      checkCAPIClusterClass(classname: string): Chainable<Element>;
      checkCAPIClusterActive(clustername: string, timeout?: number): Chainable<Element>;
      checkCAPIClusterProvisioned(clustername: string, timeout?: number): Chainable<Element>;
      checkCAPIClusterDeleted(clustername: string, timeout: number): Chainable<Element>;
      checkCAPIMenu(): Chainable<Element>;
      namespaceReset(): Chainable<Element>;
      addCustomProvider(name: string, namespace: string, providerName: string, providerType: string, version?: string, url?: string): Chainable<Element>;
      addInfraProvider(providerType: string, namespace: string, cloudCredentials?: string): Chainable<Element>;
      removeCAPIResource(resourceType: string, resourceName: string, timeout?: number): Chainable<Element>;
      addCloudCredsAWS(name: string, accessKey: string, secretKey: string): Chainable<Element>;
      addCloudCredsGCP(name: string, gcpCredentials: string): Chainable<Element>;
      addCloudCredsAzure(name: string, clientID: string, clientSecret: string, subscriptionID: string): Chainable<Element>;
      addCloudCredsVMware(name: string, vsphere_username: string, vsphere_password: string, vsphere_server: string, vsphere_server_port: string): Chainable<Element>;
      addRepository(repositoryName: string, repositoryURL: string, repositoryType: string, repositoryBranch: string): Chainable<Element>;
      typeInFilter(text: string): Chainable<Element>;
      goToHome(): Chainable<Element>;
      patchYamlResource(clusterName: string, namespace: string, resourceKind: string, resourceName: string, patch: object): Chainable<Element>;
      importYAML(yamlOrPath: string, namespace?: string, clusterName?: string): Chainable<Element>;
      verifyResourceCount(clusterName: string, resourcePath: string[], resourceName: string, namespace: string, expectedCount: number, timeout?: number): Chainable<Element>;
      exploreCluster(clusterName: string): Chainable<Element>;
      createVSphereClusterIdentity(vsphere_username: string, vsphere_password: string): Chainable<Element>;
      createAWSClusterStaticIdentity(accessKey: string, secretKey: string): Chainable<Element>;
      createCAPIProvider(providerName: string): Chainable<Element>;
      checkCAPIProvider(providerName: string): Chainable<Element>;
      verifyCAPIProviderImage(providerName: string, providerNamespace: string): Chainable<Element>;
      // Functions declared in capz_support.js
      createCAPZValuesSecret(clientID: string, tenantID: string, subscriptionID: string): Chainable<Element>;
      createAzureClusterIdentity(clientID: string, tenantID: string, clientSecret: string): Chainable<Element>;
      deleteKubernetesResource(clusterName: string, resourcePath: string[], resourceName: string, namespace?: string): Chainable<Element>;
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

require('cypress-dark');
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('cy-verify-downloads').addCustomCommand();
require('cypress-plugin-tab');
require('@rancher-ecp-qa/cypress-library');
registerCypressGrep()

// Abort on first failure in @install tests
const resultFile = './fixtures/runtime_test_result.yaml'
beforeEach(() => {
  if (Cypress.env("ci")) {
    cy.log('Running in GitHub Actions - checking previous test result');
    cy.readFile(resultFile).then((data) => {
      const content = yaml.load(data)
      // @ts-expect-error ignore 'any' error
      const result = content['test_result']
      cy.log('Previous Test Result: ' + result);
      if (result == 'failed') {
        cy.log('Stopping test run - previous test(s) have failed')
        Cypress.stop()
      }
    });
  } else cy.log('Not running in GitHub Actions - skipping test result check');
});

afterEach(function () {
  if (Cypress.env("ci") && this.currentTest?.state == 'failed' && this.currentTest?.fullTitle?.().includes('@install')) {
    const result = { test_result: this.currentTest?.state };
    const data = yaml.dump(result);
    cy.writeFile(resultFile, data);
  }
})
