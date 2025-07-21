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

Cypress.config();
describe('Import CAPD Kubeadm Class-Cluster', { tags: '@short' }, () => {
  const timeout = 600000
  const className = 'docker-kubeadm-example'
  const clusterName = className + '-cluster'
  const repoUrl = 'https://github.com/rancher/rancher-turtles-e2e.git'
  const path = '/tests/assets/rancher-turtles-fleet-example/capd/kubeadm/class-clusters'
  const branch = 'main'
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/docker/kubeadm'
  const clustersRepoName = 'docker-kb-class-clusters'
  const clusterClassRepoName = 'docker-kb-clusterclass'

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  // To validate namespace auto-import
  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Enable');
  })

  it('Create values.yaml ConfigMap', () => {
    cy.readFile('./fixtures/capd-helm-values.yaml').then((data) => {
      cy.importYAML(data)
    });
  })

  qase(92,
    it('Add CAPD Kubeadm ClusterClass using fleet', () => {
      cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath, 'capi-classes')
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(className);
    })
  );

  qase(6,
    it('Add CAPD Kubeadm class-clusters fleet repo', () => {
      cypressLib.checkNavIcon('cluster-management').should('exist');
      cy.addFleetGitRepo(clustersRepoName, repoUrl, branch, path);

      // Check CAPI cluster using its name
      cy.checkCAPICluster(clusterName);
    })
  );

  qase(94,
    it('Auto import child CAPD cluster', () => {
      // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
      cy.checkCAPIClusterProvisioned(clusterName, timeout);

      // Check child cluster is created and auto-imported
      // This is checked by ensuring the cluster is available in navigation menu
      cy.goToHome();
      cy.contains(clusterName).should('exist');

      // Check cluster is Active
      cy.searchCluster(clusterName);
      cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });

      // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
      // Ensuring cluster is provisioned also ensures all the Cluster Management > Advanced > Machines for the given cluster are Active.
      cy.checkCAPIClusterActive(clusterName, timeout);
    })
  );

  // fleet-addon provider checks (for rancher dev/2.10.3 and up)
  qase(42,
    // skip due to turtles/issues/1329
    xit('Check if cluster is registered in Fleet only once', () => {
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
        const text = editor[0].CodeMirror.getValue();
        expect(text).to.include(annotation);
      });
    })
  )

  qase(7,
    it('Install App on imported cluster', () => {
      // Click on imported CAPD cluster
      cy.contains(clusterName).click();
      // Install Chart
      // We install Logging chart instead of Monitoring, since this is relatively lightweight.
      cy.checkChart('Install', 'Logging', 'cattle-logging-system');
    })
  );

  qase(95,
    it("Scale up imported CAPD class-cluster by updating values and forcefully updating the repo", () => {
      cy.readFile('./fixtures/capd-helm-values.yaml').then((data) => {
        data = data.replace(/worker_machine_count: 2/g, 'worker_machine_count: 3')
        cy.importYAML(data)
      });

      cy.burgerMenuOperate('open');
      cy.forceUpdateFleetGitRepo(clustersRepoName);

      // Check CAPI cluster status
      cy.checkCAPIMenu();
      cy.contains('Machine Deployments').click();
      cy.typeInFilter(clusterName);
      cy.get('.content > .count', { timeout: timeout }).should('have.text', '3');
      cy.checkCAPIClusterActive(clusterName);
    })
  );

  if (skipClusterDeletion) {
    qase(98,
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

    qase(99,
      it('Delete the CAPD fleet repos', () => {
        // Remove the clusters fleet repo
        cy.removeFleetGitRepo(clustersRepoName);

        // Wait until the following returns no clusters found
        // This is checked by ensuring the cluster is not available in CAPI menu
        cy.checkCAPIClusterDeleted(clusterName, timeout);

        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);

        // Ensure the cluster is not available in navigation menu
        cy.getBySel('side-menu').then(($menu) => {
          if ($menu.text().includes(clusterName)) {
            cy.deleteCluster(clusterName);
          }
        })
      })
    );

    it('Delete the helm values ConfigMap', () => {
      cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'ConfigMaps'], "capd-helm-values", 'capi-clusters')
    })
  }
});
