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
import {vars} from '~/support/variables';

Cypress.config();
describe('Import CAPD Kubeadm Class-Cluster', {tags: '@short'}, () => {
  const timeout = vars.shortTimeout
  const classNamePrefix = 'docker-kubeadm'
  const clusterName = getClusterName(classNamePrefix)
  const classesPath = 'examples/clusterclasses/docker/kubeadm'
  const clusterClassRepoName = 'docker-kb-clusterclass'
  const dockerRegistryConfigBase64 = btoa(Cypress.env('docker_registry_config'))

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
        cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.branch, classesPath, vars.capiClassesNS)
        // Go to CAPI > ClusterClass to ensure the clusterclass is created
        cy.checkCAPIClusterClass(classNamePrefix);
      })
    );

    it('Create Docker Pull Secret', () => {
      // Prevention for Docker.io rate limiting
      cy.readFile('./fixtures/docker/capd-image-pull-secret.yaml').then((data) => {
        data = data.replace(/replace_docker_registry_config/, dockerRegistryConfigBase64)
        data = data.replace(/replace_cluster_name/g, clusterName)
        cy.importYAML(data, vars.capiClustersNS)
      })
    });
  })

  context('[CLUSTER-IMPORT]', () => {
    qase(6,
      it('Import CAPD Kubeadm class-clusters using YAML', () => {
        cy.readFile('./fixtures/docker/capd-kubeadm-class-cluster.yaml').then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)
          data = data.replace(/replace_kindVersion/g, vars.kindVersion)
          cy.importYAML(data, vars.capiClustersNS)
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

  context('[CLUSTER-OPERATIONS]', () => {

    it.skip("Check if annotation for custom cluster description set custom description the imported Rancher Cluster", () => {
      cy.burgerMenuOperate('close')
      cy.contains(new RegExp('Active.*' + `${clusterName}.*` + "This is a custom description of Rancher Cluster"));
    })

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

    // Skip until https://github.com/rancher/turtles/issues/1880 is fixed
    qase(43,
      xit('Check if annotation for externally-managed cluster is set', () => {
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
      it('Install App on imported cluster', {retries: 1}, () => {
        // Install Chart
        // We install Logging chart instead of Monitoring, since this is relatively lightweight.
        cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
      })
    );

    qase(95,
      it("Scale up imported CAPD cluster by patching class-cluster yaml", () => {
        cy.readFile('./fixtures/docker/capd-kubeadm-class-cluster.yaml').then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)

          // workaround; these values need to be re-replaced before applying the scaling changes
          data = data.replace(/replace_kindVersion/g, vars.kindVersion)
          data = data.replace(/replicas: 2/g, 'replicas: 3')
          cy.importYAML(data, vars.capiClustersNS)
        });

        // Check CAPI cluster status
        cy.checkCAPIMenu();
        cy.contains('Machine Deployments').click();
        cy.typeInFilter(clusterName);
        cy.get('.content > .count', {timeout: timeout}).should('have.text', '3');
        cy.checkCAPIClusterActive(clusterName);
      })
    );

    xit('Remove imported CAPD cluster from Rancher Manager', {retries: 1}, () => {
      // Delete the imported cluster
      // Ensure that the provisioned CAPI cluster still exists
      // this check can fail, ref: https://github.com/rancher/turtles/issues/1587
      importedRancherClusterDeletion(clusterName);
    })
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
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
