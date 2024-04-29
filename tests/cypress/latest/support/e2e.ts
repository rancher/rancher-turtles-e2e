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
      addFleetGitRepo(repoName: string, repoUrl?: string, branch?: string, path?: string): Chainable<Element>;
      removeFleetGitRepo(repoName: string): Chainable<Element>;
      accesMenuSelection(firstAccessMenu: string, secondAccessMenu?: string): Chainable<Element>;
      installApp(appName: string, namespace: string): Chainable<Element>;
      deleteCluster(clusterName: string): Chainable<Element>;
      createNamespace(namespace: string): Chainable<Element>;
      setNamespace(namespace: string): Chainable<Element>;
      checkCAPICluster(clustername: string): Chainable<Element>;
      checkCAPIMenu(): Chainable<Element>;
      namespaceReset(): Chainable<Element>;
      addCustomProvider(name: string, namespace: string, providerName: string, providerType: string, version: string, url: string): Chainable<Element>;
      addInfraProvider(providerType: string, name: string, namespace: string, cloudCredentials?: string): Chainable<Element>;
      addCloudCredsAWS(name: string, accessKey: string, secretKey: string): Chainable<Element>;
    }
  }
}

// TODO handle redirection errors better?
// we see a lot of 'error navigation cancelled' uncaught exceptions that don't actually break anything; ignore them here
Cypress.on('uncaught:exception', (err) => {
  // returning false here prevents Cypress from failing the test
  if (err.message.includes('navigation guard')) {
    return false;
  }
});

require('cypress-dark');
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('cy-verify-downloads').addCustomCommand();
require('cypress-plugin-tab');
require('@rancher-ecp-qa/cypress-library');
