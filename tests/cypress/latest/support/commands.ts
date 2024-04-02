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

  // Reload required since kebab menu icon not clickable
  cy.reload(true);
  cy.getBySel('sortable-table-0-action-button').click();

  cy.contains(mode + ' CAPI Auto-Import')
    .click();
  cy.namespaceReset();
});

// Command to set namespace selection
Cypress.Commands.add('setNamespace', (namespace) => {
  cy.contains('Only User Namespaces') // eslint-disable-line cypress/unsafe-to-chain-command
    .click()
    .type(namespace + '{enter}{esc}');
});

// Command to reset namespace selection to default 'Only User Namespaces'
Cypress.Commands.add('namespaceReset', () => {
  cy.getBySel('namespaces-values-close-0').click();
  cy.contains('Only User Namespaces').click();
  cy.getBySel('namespaces-dropdown').click();
});

// Fleet commands
// Command add Fleet Git Repository
Cypress.Commands.add('addFleetGitRepo', ({ repoName, repoUrl, branch }) => {
  cy.accesMenuSelection('Continuous Delivery', 'Git Repos');
  cy.contains('fleet-').click();
  cy.contains('fleet-local').should('be.visible').click();
  cy.clickButton('Add Repository');
  cy.contains('Git Repo:').should('be.visible');
  cy.typeValue('Name', repoName);
  cy.typeValue('Repository URL', repoUrl);
  cy.typeValue('Branch Name', branch);
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

Cypress.Commands.overwrite('type', (originalFn, subject, text, options = {}) => {
  options.delay = 100;
  return originalFn(subject, text, options);
});

// Add a delay between command without using cy.wait()
// https://github.com/cypress-io/cypress/issues/249#issuecomment-443021084
const COMMAND_DELAY = 1000;

for (const command of ['visit', 'click', 'trigger', 'type', 'clear', 'reload', 'contains']) {
  Cypress.Commands.overwrite(command, (originalFn, ...args) => {
    const origVal = originalFn(...args);

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(origVal);
      }, COMMAND_DELAY);
    });
  });
};

