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

declare global {
  // In Cypress functions should be declared with 'namespace'
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      // Functions declared in commands.ts
      namespaceAutoImport(mode: string): Chainable<Element>;
      setAutoImport(mode: string): Chainable<Element>;
      clusterAutoImport(clusterName: string, mode: string): Chainable<Element>;
      addFleetGitRepo(repoName: string, repoUrl: string, branch: string, path: string, workspace?: string): Chainable<Element>;
      removeFleetGitRepo(repoName: string, noRepoCheck?: boolean, workspace?: string): Chainable<Element>;
      forceUpdateFleetGitRepo(repoName: string, workspace?: string): Chainable<Element>;
      checkFleetGitRepo(repoName: string, workspace?: string): Chainable<Element>;
      fleetNamespaceToggle(toggleOption: string): Chainable<Element>;
      verifyTableRow(rowNumber: number, expectedText1?: string|RegExp, expectedText2?: string|RegExp): Chainable<Element>;
      accesMenuSelection(firstAccessMenu: string, secondAccessMenu?: string): Chainable<Element>;
      checkChart(operation: string, chartName: string, namespace: string, version?: string, questions?: any): Chainable<Element>;
      deleteCluster(clusterName: string): Chainable<Element>;
      deleteCAPICluster(clusterName: string, timeout: number): Chainable<Element>;
      deleteCAPIClusterClass(className: string): Chainable<Element>;
      searchCluster(clusterName: string): Chainable<Element>;
      createNamespace(namespace: string): Chainable<Element>;
      setNamespace(namespace: string): Chainable<Element>;
      createCAPICluster(className: string, clusterName: string, machineName: string, k8sVersion: string, podCIDR: string, serviceCIDR?: string): Chainable<Element>;
      checkCAPIClusterActive(clustername: string): Chainable<Element>;
      checkCAPIClusterProvisioned(clustername: string): Chainable<Element>;
      checkCAPIClusterDeleted(clustername: string, timeout: number): Chainable<Element>;
      checkCAPIMenu(): Chainable<Element>;
      namespaceReset(): Chainable<Element>;
      addCustomProvider(name: string, namespace: string, providerName: string, providerType: string, version: string, url: string): Chainable<Element>;
      addInfraProvider(providerType: string, name: string, namespace: string, cloudCredentials?: string): Chainable<Element>;
      removeCAPIResource(resourceType: string, resourceName: string): Chainable<Element>;
      addCloudCredsAWS(name: string, accessKey: string, secretKey: string): Chainable<Element>;
      addCloudCredsGCP(name: string, gcpCredentials: string): Chainable<Element>;
      addCloudCredsAzure(name: string, clientID: string, clientSecret: string, subscriptionID: string): Chainable<Element>;
      addCloudCredsVMware(name: string, vsphere_username: string, vsphere_password: string, vsphere_server: string, vsphere_server_port: string): Chainable<Element>;
      typeInFilter(text: string): Chainable<Element>;
      goToHome(): Chainable<Element>;
      patchYamlResource(clusterName: string, namespace: string, resourceKind: string, resourceName: string, patch: object): Chainable<Element>;
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
// @ts-ignore
import registerCypressGrep from '@cypress/grep'
registerCypressGrep()
