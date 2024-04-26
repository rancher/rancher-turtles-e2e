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
describe('Import CAPD', () => {
  const repoName = 'clusters'
  const clusterShort = "cluster1"
  const clusterFull = "cluster1-capi"
  const repoUrl = "https://github.com/rancher-sandbox/rancher-turtles-e2e.git"
  const basePath = "/tests/assets/rancher-turtles-fleet-example/"
  const pathNames = ['cluster_autoimport', 'namespace_autoimport']
  const branch = "main"

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  // TODO: Refactor tests to reduce running time
  pathNames.forEach((path) => {

    qase(13,
      it('Setup the namespace for importing', () => {
        if (path == 'namespace_autoimport') {
          cy.namespaceAutoImport('Enable');
        } else {
          cy.namespaceAutoImport('Disable');
        }
      })
    );

    qase(14,
      it('Import CAPD cluster using fleet', () => {
        cypressLib.checkNavIcon('cluster-management')
          .should('exist');
        path = basePath + path
        // Add CAPD fleet repository
        cy.addFleetGitRepo({ repoName, repoUrl, branch, path });
        cy.contains(repoName).click();
      })
    );

    qase(15,
      it('Auto import child CAPD cluster', () => {
        // Check child cluster is created and auto-imported
        cy.visit('/');
        cy.contains('Pending ' + clusterFull, { timeout: 120000 });

        // Check cluster is Active
        cy.clickButton('Manage');
        cy.contains('Active ' + clusterFull, { timeout: 180000 });
        cy.checkCAPICluster(clusterShort);
      })
    );

    qase(16,
      it('Install App on imported cluster', { retries: 1 }, () => {

        // Click on imported CAPD cluster
        cy.contains(clusterFull).click();

        // Install App
        cy.installApp('Monitoring', 'cattle-monitoring');
      })
    );

    qase(17,
      it('Scale imported CAPD cluster', () => {

        // Access CAPI cluster
        cy.accesMenuSelection('Cluster Management', 'CAPI');
        cy.contains("Machine Deployments").click();
        cy.getBySel('sortable-table-0-action-button').click();
        cy.contains('Edit YAML')
          .click();
        cy.get('.CodeMirror')
          .then((editor) => {
            var text = editor[0].CodeMirror.getValue();
            text = text.replace(/replicas: 2/g, 'replicas: 3');
            editor[0].CodeMirror.setValue(text);
            cy.clickButton('Save');
          })

        // Check CAPI cluster status
        cy.contains('Machine Deployments').click();
        cy.get('.content > .count', { timeout: 150000 }).should('have.text', '3');
        cy.checkCAPICluster(clusterShort);
      })
    );

    qase(18,
      it('Remove imported CAPD cluster from Rancher Manager', () => {

        // Check cluster is not deleted after removal
        cy.deleteCluster(clusterFull);
        cy.visit('/');
        cy.checkCAPICluster(clusterShort);
      })
    );

    qase(19,
      it('Delete the CAPD cluster fleet repo', () => {

        // Remove the fleet git repo
        cy.removeFleetGitRepo(repoName)
        // Wait until the following returns no clusters found:
        // kubectl get clusters.cluster.x-k8s.io
        // This is checked by ensuring the cluster is not available in navigation menu and CAPI menu
        cy.contains(clusterFull, { timeout: 120000 }).should('not.exist');
        cypressLib.burgerMenuToggle();
        cy.accesMenuSelection('Cluster Management', 'CAPI');
        cy.contains(clusterShort, { timeout: 150000 }).should('not.exist');
      })
    );

  })
});
