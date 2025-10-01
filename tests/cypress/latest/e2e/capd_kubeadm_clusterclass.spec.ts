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
import {qase} from 'cypress-qase-reporter/mocha';
import {getClusterName, skipClusterDeletion} from '~/support/utils';
import {capiClusterDeletion, importedRancherClusterDeletion} from "~/support/cleanup_support";

Cypress.config();
describe('Import CAPD Kubeadm Class-Cluster', { tags: '@short' }, () => {
  const timeout = 600000
  const classNamePrefix = 'docker-kubeadm'
  const clusterName = getClusterName(classNamePrefix)
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/docker/kubeadm'
  const clusterClassRepoName = 'docker-kb-clusterclass'
  const dockerRegistryConfigBase64 = btoa(Cypress.env('docker_registry_config'))
  const capiClustersNS = 'capi-clusters'

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('[SETUP]', () => {
    // To validate namespace auto-import
    it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Enable');
    })

    qase(92,
      it('Add CAPD Kubeadm ClusterClass using fleet', () => {
        cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath, 'capi-classes')
        // Go to CAPI > ClusterClass to ensure the clusterclass is created
        cy.checkCAPIClusterClass(classNamePrefix);
      })
    );

    it('Create Docker Pull Secret', () => {
      // Prevention for Docker.io rate limiting
      cy.readFile('./fixtures/docker/capd-image-pull-secret.yaml').then((data) => {
        data = data.replace(/replace_docker_registry_config/, dockerRegistryConfigBase64)
        data = data.replace(/replace_cluster_name/g, clusterName)
        cy.importYAML(data, capiClustersNS)
      })
    });


    context('[CLUSTER-IMPORT]', () => {
      qase(6,
        it('Import CAPD Kubeadm class-clusters using YAML', () => {
          cy.readFile('./fixtures/docker/capd-kubeadm-class-cluster.yaml').then((data) => {
            data = data.replace(/replace_cluster_name/g, clusterName)
            cy.importYAML(data, capiClustersNS)
          });

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
          cy.contains(new RegExp('Active.*' + clusterName), {timeout: timeout});

          // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
          // Ensuring cluster is provisioned also ensures all the Cluster Management > Advanced > Machines for the given cluster are Active.
          cy.checkCAPIClusterActive(clusterName, timeout);
        })
      );
    })
  })

  context('[POST-SETUP]', () => {
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
        // click the three-dots menu and click View YAML
        cy.getBySel('sortable-table-0-action-button').click();
        cy.contains('View YAML').click();
        const annotation = 'provisioning.cattle.io/externally-managed: \'true\'';
        cy.get('.CodeMirror').then((editor) => {
          // @ts-expect-error known error with CodeMirror
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
      it("Scale up imported CAPD cluster by patching class-cluster yaml", () => {
        cy.readFile('./fixtures/docker/capd-kubeadm-class-cluster.yaml').then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)
          data = data.replace(/replicas: 2/g, 'replicas: 3')
          cy.importYAML(data, 'capi-clusters')
        });

        // Check CAPI cluster status
        cy.checkCAPIMenu();
        cy.contains('Machine Deployments').click();
        cy.typeInFilter(clusterName);
        cy.get('.content > .count', {timeout: timeout}).should('have.text', '3');
        cy.checkCAPIClusterActive(clusterName);
      })
    );
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
      it('Remove imported CAPD cluster from Rancher Manager', {retries: 1}, () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        // this check can fail, ref: https://github.com/rancher/turtles/issues/1587
        importedRancherClusterDeletion(clusterName);
      })

      qase(98,
        it('Delete the CAPD cluster', {retries: 1}, () => {
          // Remove CAPI Resources related to the cluster
          capiClusterDeletion(clusterName, timeout);
        })
      );

      qase(99,
        it('Delete the ClusterClass fleet repo', () => {
          // Remove the clusterclass repo
          cy.removeFleetGitRepo(clusterClassRepoName);
        })
      );
    }
  })
});
