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
  const timeoutShort = 180000
  const timeoutFull = 300000
  const repoName = 'clusters'
  const clusterName = "cluster1"
  const repoUrl = "https://github.com/rancher/rancher-turtles-e2e.git"
  const basePath = "/tests/assets/rancher-turtles-fleet-example/"
  const pathNames = ['cluster_autoimport', 'namespace_autoimport', 'rke2_namespace_autoimport']
  const branch = "main"

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  pathNames.forEach((path) => {

    it('Setup the namespace for importing', () => {
      if (path.includes('namespace_autoimport')) {
        cy.namespaceAutoImport('Enable');
      } else {
        cy.namespaceAutoImport('Disable');
      }
    })

    qase(5,
      it('Add CAPD cluster fleet repo - ' + path, () => {
        cypressLib.checkNavIcon('cluster-management')
          .should('exist');
        path = basePath + path
        // Add CAPD fleet repository
        cy.addFleetGitRepo(repoName, repoUrl, branch, path);
        cy.contains(repoName).click();
      })
    );

    qase(6,
      it('Auto import child CAPD cluster', () => {
        // Check child cluster is created and auto-imported
        cy.goToHome();
        cy.contains('Pending ' + clusterName, { timeout: timeoutFull });

        // Check cluster is Active
        cy.clickButton('Manage');
        cy.contains('Active ' + clusterName, { timeout: timeoutFull });
        // TODO: Check MachineSet unavailable status and use checkCAPIClusterActive
        cy.checkCAPIClusterProvisioned(clusterName);
      })
    );

    it('Install App on imported cluster', { retries: 1 }, () => {
      // Click on imported CAPD cluster
      cy.contains(clusterName).click();

      // Install App
      cy.installApp('Monitoring', 'cattle-monitoring');
    })

    // TODO: Add test for RKE2 also
    if (!path.includes('rke2')) {
      qase(12,
        it('Scale up imported CAPD cluster', () => {
          // Access CAPI cluster
          cy.checkCAPIMenu();
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
          cy.get('.content > .count', { timeout: timeoutFull }).should('have.text', '3');
          cy.checkCAPIClusterProvisioned(clusterName);
        })
      );
    }

    qase(9,
      it('Remove imported CAPD cluster from Rancher Manager', { retries: 1 }, () => {
        // Check cluster is not deleted after removal
        cy.deleteCluster(clusterName);
        cy.goToHome();
        // kubectl get clusters.cluster.x-k8s.io
        // This is checked by ensuring the cluster is not available in navigation menu
        cy.contains(clusterName).should('not.exist');
        cy.checkCAPIClusterProvisioned(clusterName);
      })
    );

    qase(10,
      it('Delete the CAPD cluster fleet repo - ' + path, () => {
        // Remove the fleet git repo
        cy.removeFleetGitRepo(repoName)
      // Wait until the following returns no clusters found
      // This is checked by ensuring the cluster is not available in CAPI menu
        cypressLib.burgerMenuToggle();
        cy.checkCAPIMenu();
        cy.getBySel('button-group-child-1').click();
        cy.typeInFilter(clusterName);
        cy.getBySel('sortable-table-0-action-button', { timeout: timeoutFull }).should('not.exist');
        // Ensure the cluster is not available in navigation menu
        cy.getBySel('side-menu').then(($menu) => {
          if ($menu.text().includes(clusterName)) {
            cy.deleteCluster(clusterName);
          }
        })
      })
    );

  })
});
