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
describe('Enable CAPD provider', () => {
  const namespace = "capd-system"
  const deployment = "rancher-turtles-controller-manager"

  beforeEach(() => {
    cy.login();
    cy.visit('/');
    cypressLib.burgerMenuToggle();
  });

  qase(11,
    it('CAPD prerequisites', () => {

      // Open Rancher turtles deployment
      cy.contains('local')
        .click();
      cy.get('.nav').contains('Workloads')
        .click();
      cy.get('.nav').contains('Deployments')
        .click();
      cy.setNamespace('rancher-turtles-system');

      // Edit Rancher turtles deployment
      cy.getBySel('sortable-table-1-action-button').click();
      cy.contains('Edit Config')
        .click();
      cy.byLabel('Arguments').as('label')
      cy.get('@label').type(' --insecure-skip-verify=true')
      cy.clickButton('Save');
      cy.contains('Active' + ' ' + deployment, {timeout: 20000});
      cy.namespaceReset();
    })
  );

  qase(12,
    it('Create CAPD namespace', () => {
      cy.contains('local')
        .click();
      cypressLib.accesMenu('Projects/Namespaces');
      cy.setNamespace('Not');

      // Create CAPD namespace
      cy.contains('Create Namespace')
        .click();
      cy.typeValue('Name', namespace);
      cy.clickButton('Create');
      cy.contains('Active' + ' ' + namespace);
      cy.namespaceReset();
    })
  );

  qase(13,
    it('Create CAPD provider', () => {
      cypressLib.checkNavIcon('cluster-management')
        .should('exist');

      // Open Turtles menu
      cy.accesMenuSelection('Cluster Management', 'CAPI');

      // Create CAPD Infrastructure provider
      cy.contains('Infrastructure Providers').click();
      cy.clickButton('Create from YAML')
      cy.readFile('./fixtures/capd-provider.yaml').then((data) => {
        cy.get('.CodeMirror')
          .then((editor) => {
            editor[0].CodeMirror.setValue(data);
          })
      })
      cy.clickButton('Create')
      cy.contains('Active ' + 'docker');
    })
  );

  qase(14,
    it('Enable CAPI Kubeadm provider', () => {
      cy.contains('local')
        .click();
      cypressLib.accesMenu('Projects/Namespaces');
      cy.setNamespace('Not');

      // Create CAPI Kubeadm provider
      cy.get('.header-buttons > :nth-child(1) > .icon')
        .click();
      cy.contains('Import YAML');
      cy.readFile('./fixtures/capi-kubeadm-provider.yaml').then((data) => {
        cy.get('.CodeMirror')
          .then((editor) => {
            editor[0].CodeMirror.setValue(data);
          })
      })

      cy.clickButton('Import')
      cy.clickButton('Close')
      cy.contains('Active ' + 'capi-kubeadm-bootstrap-system');
      cy.contains('Active ' + 'capi-kubeadm-control-plane-system');

      cy.namespaceReset();
    })
  );

});
