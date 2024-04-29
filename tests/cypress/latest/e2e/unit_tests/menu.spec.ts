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
describe('Menu testing', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/');
    cypressLib.burgerMenuToggle();
  });

  qase(3,
    it('Check Turtles menu', () => {
      // Cluster Management's icon should appear in the side menu
      cypressLib.checkNavIcon('cluster-management')
        .should('exist');

      // Open Turtles menu
      cy.accesMenuSelection('Cluster Management', 'CAPI');

      // Check Turtles's side menu
      cy.checkCAPIMenu();
    })
  );
});
