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
import { skipClusterDeletion } from '~/support/utils';
import { isRancherManagerVersion } from '~/support/utils';

Cypress.config();
describe('Import CAPD Kubeadm', { tags: '@short' }, () => {
  var clusterName: string, clusterPrefix: string
  const timeout = 300000
  const namePrefix = 'docker-kubeadm-'
  const clustersPath = 'clusters'
  const classClustersPath = 'class-' + clustersPath
  const className = namePrefix + 'example'
  const clusterNamePrefix = namePrefix + 'cluster' // as per fleet values
  const repoUrl = 'https://github.com/rancher/rancher-turtles-e2e.git'
  const basePath = '/tests/assets/rancher-turtles-fleet-example/capd/kubeadm/'
  const pathNames = [clustersPath, classClustersPath]
  const branch = 'main'

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  pathNames.forEach((path) => {
    const clustersRepoName = namePrefix + path

    it('Setup the namespace for importing', () => {
      if (path == clustersPath) {
        cy.namespaceAutoImport('Enable');
      } else {
        cy.namespaceAutoImport('Disable');
      }
    })

    it('Add CAPD cluster fleet repo - ' + path + ' and get cluster name', () => {
      cypressLib.checkNavIcon('cluster-management').should('exist');
      var fullPath = basePath + path
      cy.addFleetGitRepo(clustersRepoName, repoUrl, branch, fullPath);

      if (path == classClustersPath && isRancherManagerVersion("2.10")) {
        // Add cni gitrepo to fleet-default workspace
        // The cni gitrepo is scoped to docker-kubeadm-example only by fleet.yaml
        cypressLib.burgerMenuToggle();
        cy.addFleetGitRepo(clustersRepoName+'-cni', repoUrl, branch, basePath + 'cni', 'fleet-default');
      }

      if (path == clustersPath) {
        clusterPrefix = clusterNamePrefix
      } else {
        clusterPrefix = className
      }
      // Check CAPI cluster using its name prefix
      cy.checkCAPICluster(clusterPrefix);
      // Get the cluster name by its prefix and use it across the test
      cy.getBySel('sortable-cell-0-1').then(($cell) => {
        clusterName = $cell.text();
        cy.log('CAPI Cluster Name:', clusterName);
      });
    })

    if (path == clustersPath) { var qase_id = 6 } else { qase_id = 5 }
    qase(qase_id,
      it('Auto import child CAPD cluster', () => {
        // Check child cluster is created and auto-imported
        cy.goToHome();
        cy.contains(new RegExp('Pending.*' + clusterName), { timeout: timeout });

        // Check cluster is Active
        cy.searchCluster(clusterName);
        cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });
        // TODO: Check MachineSet unavailable status and use checkCAPIClusterActive
        cy.checkCAPIClusterProvisioned(clusterName);
      })
    );

    // fleet-addon provider checks (for rancher dev/2.10.3 and up)
    if (path == classClustersPath) {
      qase(42,
        it('Check if cluster is registered in Fleet only once', () => {
          cypressLib.accesMenu('Continuous Delivery');
          cy.contains('Dashboard').should('be.visible');
          cypressLib.accesMenu('Clusters');
          cy.fleetNamespaceToggle('fleet-default');
          // Verify the cluster is registered and Active
          const rowNumber = 0
          cy.verifyTableRow(rowNumber, 'Active', clusterName);
          // Make sure there is only one registered cluster in fleet (there should be one table row)
          cy.get('table.sortable-table').find(`tbody tr[data-testid="sortable-table-${rowNumber}-row"]`).should('have.length', 1);
        })
      )
      qase(43,
        it('Check if annotation for externally-managed cluster is set', () => {
          cy.searchCluster(clusterName)
          // click three dots menu and click View YAML
          cy.getBySel('sortable-table-0-action-button').click();
          cy.contains('View YAML').click();
          const annotation = 'provisioning.cattle.io/externally-managed: \'true\'';
          cy.get('.CodeMirror').then((editor) => {
            var text = editor[0].CodeMirror.getValue();
            expect(text).to.include(annotation);
          });
        })
      )
    }

    if (path == clustersPath) {
      qase(7,
        it('Install App on imported cluster', { retries: 1 }, () => {
          // Click on imported CAPD cluster
          cy.contains(clusterName).click();
          // Install Chart
          cy.checkChart('Install', 'Monitoring', 'cattle-monitoring');
        })
      );

      qase(8,
        it('Scale the imported CAPD cluster', () => {
          // Access CAPI cluster
          cy.checkCAPIMenu();
          cy.contains('Machine Deployments').click();
          cy.typeInFilter(clusterName);
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
          cy.typeInFilter(clusterName);
          cy.get('.content > .count', { timeout: timeout }).should('have.text', '3');
          cy.checkCAPIClusterProvisioned(clusterName);
        })
      );
    }

    if (skipClusterDeletion) {
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
        it('Delete the CAPD fleet repo - ' + path, () => {
          if (path == classClustersPath && isRancherManagerVersion("2.10")) {
            // Remove the cni fleet repo
            cy.removeFleetGitRepo(clustersRepoName+'-cni', 'fleet-default');
            cypressLib.burgerMenuToggle();
          }
          // Remove the clusters fleet repo
          cy.removeFleetGitRepo(clustersRepoName);

          // Wait until the following returns no clusters found
          // This is checked by ensuring the cluster is not available in CAPI menu
          cy.checkCAPIClusterDeleted(clusterName, timeout);

          // Ensure the cluster is not available in navigation menu
          cy.getBySel('side-menu').then(($menu) => {
            if ($menu.text().includes(clusterName)) {
              cy.deleteCluster(clusterName);
            }
          })
        })
      );
    }
  })
});
