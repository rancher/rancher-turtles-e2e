/*
Copyright © 2022 - 2025 SUSE LLC
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
import {qase} from 'cypress-qase-reporter/mocha';
import {getClusterName, isRancherManagerVersion} from '~/support/utils';
import {capdResourcesCleanup, capiClusterDeletion, importedRancherClusterDeletion} from "~/support/cleanup_support";

Cypress.config();
describe('Import CAPD RKE2 Class-Cluster for Upgrade', { tags: '@upgrade' }, () => {
  const timeout = 600000
  const classNamePrefix = 'docker-rke2'
  const clusterName = getClusterName(classNamePrefix)
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/docker/rke2'
  const clusterClassRepoName = "docker-rke2-clusterclass"
  const dockerAuthUsernameBase64 = btoa(Cypress.env("docker_auth_username"))
  const dockerAuthPasswordBase64 = btoa(Cypress.env("docker_auth_password"))
  const capiClustersNS = 'capi-clusters'

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('Pre-Upgrade', () => {
    if (isRancherManagerVersion('2.11')) {
      it('Setup the namespace for importing', () => {
        cy.namespaceAutoImport('Disable');
      })

      it('Create Docker Auth Secret', () => {
        // Prevention for Docker.io rate limiting
        cy.readFile('./fixtures/docker/capd-auth-token-secret.yaml').then((data) => {
          data = data.replace(/replace_cluster_docker_auth_username/, dockerAuthUsernameBase64)
          data = data.replace(/replace_cluster_docker_auth_password/, dockerAuthPasswordBase64)
          cy.importYAML(data, capiClustersNS)
        })
      });

      qase(91,
        it('Add CAPD RKE2 ClusterClass Fleet Repo', () => {
          cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath, 'capi-classes')
          // Go to CAPI > ClusterClass to ensure the clusterclass is created
          cy.checkCAPIClusterClass(classNamePrefix);
        })
      );


      it('Import CAPD RKE2 class-clusters using YAML', () => {
        cy.readFile('./fixtures/docker/capd-rke2-class-cluster.yaml').then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)
          cy.importYAML(data, capiClustersNS)
        });

        // Check CAPI cluster using its name
        cy.checkCAPICluster(clusterName);
      })

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
    }
  })

  context('Post-Upgrade', () => {
    if (isRancherManagerVersion('2.12')) {
      it('Upgrade turtles chart and check cluster status', () => {
        cy.contains('local').click();
        // This upgrades Turtles chart from v0.21.0 to latest dev version
        cy.checkChart('Upgrade', 'Rancher Turtles', 'rancher-turtles-system', '');

        // Check CAPI operator deployment to be removed
        cy.exploreCluster('local');
        cy.accesMenuSelection(['Workloads', 'Deployments']);
        cy.typeInFilter('rancher-turtles-cluster-api-operator');
        cy.getBySel('sortable-cell-0-1').should('not.exist');
        cy.accesMenuSelection(['Workloads', 'Pods']);
        cy.waitForAllRowsInState('Running', 300000);

        // Check CAPI cluster is Active
        cy.searchCluster(clusterName);
        cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });
        cy.checkCAPIClusterActive(clusterName, timeout);
      })

      it('Install App on imported cluster', () => {
        // Click on imported CAPD cluster
        cy.contains(clusterName).click();

        // Install Chart
        // We install Logging chart instead of Monitoring, since this is relatively lightweight.
        cy.checkChart('Install', 'Logging', 'cattle-logging-system');
      })

      it("Scale up imported CAPD cluster by patching class-cluster yaml", () => {
        cy.readFile('./fixtures/docker/capd-rke2-class-cluster.yaml').then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)
          data = data.replace(/replicas: 2/g, 'replicas: 3')
          cy.importYAML(data, capiClustersNS)
        });

        // Check CAPI cluster status
        cy.checkCAPIMenu();
        cy.contains('Machine Deployments').click();
        cy.typeInFilter(clusterName);
        cy.get('.content > .count', { timeout: timeout }).should('have.text', '3');
        cy.checkCAPIClusterActive(clusterName);
      })

      it('Remove imported CAPD cluster from Rancher Manager and Delete the CAPD cluster', {retries: 1}, () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        // this check can fail, ref: https://github.com/rancher/turtles/issues/1587
        importedRancherClusterDeletion(clusterName);
        // Remove CAPI Resources related to the cluster
        capiClusterDeletion(clusterName, timeout);
      })

      it('Delete the ClusterClass fleet repo', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);
        // Cleanup other resources
        capdResourcesCleanup();
      })
    }
  })
});
