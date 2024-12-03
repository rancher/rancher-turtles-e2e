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
describe('Install Turtles Operator', { tags: '@install' }, () => {
  const deployment = 'rancher-turtles-controller-manager'

  beforeEach(() => {
    cy.login();
    cy.reload();
    cypressLib.burgerMenuToggle();
  });

  it('Add turtles repo', { retries: 2 }, () => {
    var turtlesHelmRepo = Cypress.env('chartmuseum_repo')
    if (turtlesHelmRepo == undefined) {
      turtlesHelmRepo = 'https://rancher.github.io/turtles/'
    } else {
      turtlesHelmRepo += ':8080'
    }
    cypressLib.addRepository('turtles-operator', turtlesHelmRepo, 'helm', 'none');
  })

  qase([2, 11],
    it('Install Turtles operator', { retries: 1 }, () => {
      cy.contains('local').click();

      // Used for enabling fleet-addon feature within Rancher Turtles installation
      const questions = [
        { menuEntry: 'Rancher Turtles Features Settings', checkbox: 'Seamless integration with Fleet and CAPI' }
      ];
      cy.installApp('Rancher Turtles', 'rancher-turtles-system', questions);
    })
  );

  it('Turtles prerequisites', () => {

    // Open Rancher turtles deployment
    cy.contains('local')
      .click();
    cy.get('.nav').contains('Workloads')
      .click();
    cy.get('.nav').contains('Deployments')
      .click();
    cy.setNamespace('rancher-turtles-system');

    // Edit Rancher turtles deployment
    cy.typeInFilter(deployment);
    cy.getBySel('sortable-table-0-action-button').click();
    cy.contains('Edit Config')
      .click();
    cy.byLabel('Arguments').as('label')
    cy.get('@label').type(' --insecure-skip-verify=true')
    cy.clickButton('Save');
    cy.contains(new RegExp('Active.*' + deployment));
    cy.namespaceReset();
  })

});
