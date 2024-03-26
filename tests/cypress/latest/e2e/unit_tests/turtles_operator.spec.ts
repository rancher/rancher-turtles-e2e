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
import * as utils from "~/support/utils";

Cypress.config();
describe('Install Turtles Operator', () => {

  beforeEach(() => {
    cy.login();
    cy.visit('/');
    cypressLib.burgerMenuToggle();
  });

  qase(11,
    it('Add local chartmuseum repo', () => {
      cypressLib.addRepository('turtles-operator', Cypress.env('chartmuseum_repo') + ':8080', 'helm', 'none');
    })
  );

  qase(13,
    it('Install Turtles operator', () => {
      cy.contains('local')
        .click();
      cy.get('.nav').contains('Apps')
        .click();
      cy.contains('.item.has-description.color2', 'Rancher Turtles', { timeout: 30000 })
        .click();
      cy.contains('Charts: Rancher Turtles', { timeout: 30000 });
      cy.clickButton('Install');
      cy.contains('.outer-container > .header', 'Rancher Turtles');
      cy.clickButton('Next');
      cy.clickButton('Install');
      
      // Close the shell to avoid conflict
      cy.get('.closer', {timeout:20000}).click();
      // Select rancher-turtles-system namespace
      cy.setNamespace('rancher-turtles-system');
      // Resource should be deployed (green badge)
      cy.get('.outlet').contains('Deployed rancher-turtles', {timeout: 240000});
    })
  );
});
