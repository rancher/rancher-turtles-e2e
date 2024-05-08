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

// In this file you can write your custom commands and overwrite existing commands.

import 'cypress-file-upload';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';

// Generic commands
// Go to specific Sub Menu from Access Menu
Cypress.Commands.add('accesMenuSelection', (firstAccessMenu, secondAccessMenu) => {
  cypressLib.accesMenu(firstAccessMenu);
  cypressLib.accesMenu(secondAccessMenu);
});

// Command to set CAPI Auto-import on default namespace
Cypress.Commands.add('namespaceAutoImport', (mode) => {
  cy.contains('local')
    .click();
  cypressLib.accesMenu('Projects/Namespaces');
  cy.contains('Create Project')
    .should('be.visible');

  // Select default namespace
  cy.setNamespace('Project: Default');
  cy.getBySel('sortable-table-0-action-button').click();

  // If the desired mode is already in place, then simply reload the page.
  cy.get('.list-unstyled.menu').then(($list) => {
    if ($list.text().includes(mode + ' CAPI Auto-Import')) {
      cy.contains(mode + ' CAPI Auto-Import').click();
    } else {
      // Workaround to close the dropdown menu
      cy.reload();
    }
  })
  cy.namespaceReset();
});

// Command to create namespace
Cypress.Commands.add('createNamespace', (namespace) => {
  cy.contains('local')
    .click();
  cypressLib.accesMenu('Projects/Namespaces');
  cy.setNamespace('Not');

  // Create namespace
  cy.contains('Create Namespace').click();
  cy.typeValue('Name', namespace);
  cy.clickButton('Create');
  cy.contains('Active' + ' ' + namespace);
  cy.namespaceReset();
});

// Command to set namespace selection
// TODO(pvala): Could be improved to check if the namespace is already set before changing it
Cypress.Commands.add('setNamespace', (namespace) => {
  cy.getBySel('namespaces-dropdown', { timeout: 12000 }).trigger('click');
  cy.get('.ns-clear').click();
  cy.get('.ns-filter-input').type(namespace + '{enter}{esc}');
});

// Command to reset namespace selection to default 'Only User Namespaces'
Cypress.Commands.add('namespaceReset', () => {
  cy.setNamespace('Only User Namespaces');
});

// Command to check CAPI cluster Active status
Cypress.Commands.add('checkCAPICluster', (clusterName) => {
  cypressLib.burgerMenuToggle();
  cy.accesMenuSelection('Cluster Management', 'CAPI');
  cy.checkCAPIMenu();
  cy.contains('Provisioned ' + clusterName, { timeout: 30000 });
  cy.contains('Machine Deployments').click();
  cy.contains('Running ' + clusterName, { timeout: 30000 });
  cy.contains('Machine Sets').click();
  cy.contains('Active ' + clusterName, { timeout: 30000 });
});

// Command to check CAPI Menu is visible
Cypress.Commands.add('checkCAPIMenu', () => {
  cy.contains('.nav', 'Clusters')
  cy.contains('.nav', 'Machine Deployments')
  cy.contains('.nav', 'Machine Sets')
  cy.contains('.nav', 'Cluster Classes')
  cy.contains('.nav', 'Providers')
});

// Command to add CAPI Custom provider
Cypress.Commands.add('addCustomProvider', (name, namespace, providerName, providerType, version, url) => {
  // Navigate to providers Menu
  cy.accesMenuSelection('Cluster Management', 'CAPI');
  cy.checkCAPIMenu();
  cy.contains('Providers').click();
  cy.clickButton('Create');
  cy.contains('Custom').click();

  // Select provider type
  cy.contains("Provider type").click();
  cy.contains(providerType, { matchCase: false }).click();

  cy.getBySel('name-ns-description-namespace').type(namespace + '{enter}');
  cy.typeValue('Name', name);
  cy.typeValue('Provider', providerName);
  cy.typeValue('Version', version);
  cy.typeValue('URL', url);
  cy.clickButton('Create');
  cy.contains('Providers').should('be.visible');
});

// Command to add CAPI Infrastructure provider
Cypress.Commands.add('addInfraProvider', (providerType, name, namespace, cloudCredentials) => {
  // Navigate to providers Menu
  cy.accesMenuSelection('Cluster Management', 'CAPI');
  cy.checkCAPIMenu();
  cy.contains('Providers').click();
  cy.clickButton('Create');
  cy.contains(providerType, { matchCase: false }).click();
  cy.contains('Provider: Create ' + providerType, { matchCase: false }).should('be.visible');

  // TODO: Add variables support after capi-ui-extension/issues/49
  cy.getBySel('name-ns-description-namespace').type(namespace + '{enter}');
  cy.typeValue('Name', name);

  // Select Cloud credntials name
  if (providerType != 'docker') {
    cy.getBySel('cluster-prov-select-credential').trigger('click');
    cy.contains(cloudCredentials).click();
  }
  cy.clickButton('Create');
  cy.contains('Providers').should('be.visible');
});

// Command to add AWS Cloud Credentials
Cypress.Commands.add('addCloudCredsAWS', (name, accessKey, secretKey) => {
  cy.accesMenuSelection('Cluster Management', 'Cloud Credentials');
  cy.contains('API Key').should('be.visible');
  cy.clickButton('Create');
  cy.contains('Amazon').click();
  cy.typeValue('Name', name);
  cy.typeValue('Access Key', accessKey);
  cy.typeValue('Secret Key', secretKey, false, false );
  cy.clickButton('Create');
  cy.getBySel('name-ns-description-name').should('not.exist');
});

// Command to Install App from Charts menu
Cypress.Commands.add('installApp', (appName, namespace) => {
  cy.get('.nav').contains('Apps').click();
  cy.contains('Featured Charts').should('be.visible');
  cy.contains(appName, { timeout: 60000 }).click();
  cy.contains('Charts: ' + appName, { timeout: 30000 });
  cy.clickButton('Install');
  cy.contains('.outer-container > .header', appName);
  cy.clickButton('Next');
  cy.clickButton('Install');

  // Close the shell to avoid conflict
  cy.get('.closer', { timeout: 30000 }).click();

  // Select app namespace
  cy.setNamespace(namespace);

  // Resource should be deployed (green badge)
  cy.get('.outlet').contains('Deployed', { timeout: 180000 });
  cy.namespaceReset();
});

// Command to remove cluster
Cypress.Commands.add('deleteCluster', (clusterName) => {
  cy.visit('/');
  cy.clickButton('Manage');
  cy.contains('Active' + ' ' + clusterName);

  cy.viewport(1920, 1080);
  cy.get('.input-sm')
    .click()
    .type(clusterName);
  cy.getBySel('sortable-table_check_select_all').click();
  cy.clickButton('Delete');
  cy.getBySel('prompt-remove-input')
    .type(clusterName);
  cy.getBySel('prompt-remove-confirm-button').click();
  cy.contains('Active' + ' ' + clusterName).should('not.exist', { timeout: 30000 });
});

// Fleet commands
// Command add Fleet Git Repository
Cypress.Commands.add('addFleetGitRepo', ({ repoName, repoUrl, branch, path }) => {
  cy.accesMenuSelection('Continuous Delivery', 'Git Repos');
  cy.contains('fleet-').click();
  cy.contains('fleet-local').should('be.visible').click();
  cy.clickButton('Add Repository');
  cy.contains('Git Repo:').should('be.visible');
  cy.typeValue('Name', repoName);
  cy.typeValue('Repository URL', repoUrl);
  cy.typeValue('Branch Name', branch);
  cy.clickButton('Add Path');
  cy.getBySel('gitRepo-paths').within(($gitRepoPaths) => {
    cy.getBySel('input-0').type(path);
  })
  cy.clickButton('Next');
  cy.get('button.btn').contains('Previous').should('be.visible');
  cy.clickButton('Create');
})

// Command remove Fleet Git Repository
Cypress.Commands.add('removeFleetGitRepo', (repoName) => {
  // Go to 'Continuous Delivery' > 'Git Repos'
  cy.accesMenuSelection('Continuous Delivery', 'Git Repos');
  // Change the namespace to fleet-local using the dropdown on the top bar
  cy.contains('fleet-').click();
  cy.contains('fleet-local').should('be.visible').click();
  // Click the repo link
  cy.contains(repoName).click();
  cy.url().should("include", "fleet/fleet.cattle.io.gitrepo/fleet-local/clusters")
  // Click on the actions menu and select 'Delete' from the menu
  cy.get('.actions .btn.actions').click();
  cy.get('.icon.group-icon.icon-trash').click();
  cypressLib.confirmDelete();
})
