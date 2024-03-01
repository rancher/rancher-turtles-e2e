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

import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';

Cypress.config();
describe('Namespace testing', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/');
    cypressLib.burgerMenuToggle();
  });

  qase(4,
    it('Enable namespace auto-import', () => {
      cy.contains('local')
        .click();
      cypressLib.accesMenu('Projects/Namespaces');
      cy.contains('Create Project')
        .should('be.visible');
      // Reload required till capi-ui-extension/issues/17 is fixed
      cy.reload(true);

      // Select default namespace
      cy.contains('Only User Namespaces') // eslint-disable-line cypress/unsafe-to-chain-command
        .click()
        .type('Project: Default{enter}{esc}');

      // Commenting till capi-ui-extension/issues/17 is fixed
      // cy.get('.outlet').contains('CAPI Auto-Import');

      // Reload required since kebab menu icon not clickable
      cy.reload(true);
      cy.getBySel('sortable-table-0-action-button').click();
      cy.contains('Enable CAPI Auto-Import')
        .click();

      cy.getBySel('namespaces-values').click();
      cy.contains('Only User Namespaces')
        .click();

    })
  );
});
