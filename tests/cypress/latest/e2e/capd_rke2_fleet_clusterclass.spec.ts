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
import {skipClusterDeletion} from '~/support/utils';
import {capiClusterDeletion, importedRancherClusterDeletion} from "~/support/cleanup_support";

Cypress.config();
describe('Import CAPD RKE2 Class-Cluster', { tags: '@short' }, () => {
  let clusterName: string
  const timeout = 600000
  const classNamePrefix = 'docker-rke2'
  const repoUrl = 'https://github.com/rancher/rancher-turtles-e2e.git'
  const path = '/tests/assets/rancher-turtles-fleet-example/capd/rke2/class-clusters'
  const branch = 'main'
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/docker/rke2'
  const clustersRepoName = 'docker-rke2-class-clusters'
  const clusterClassRepoName = "docker-rke2-clusterclass"
  const dockerAuthUsernameBase64 = btoa(Cypress.env("docker_auth_username"))
  const dockerAuthPasswordBase64 = btoa(Cypress.env("docker_auth_password"))
  const capiClustersNS = 'capi-clusters'

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

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

  it('Add CAPD RKE2 ClusterClass Fleet Repo', () => {
    cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath, 'capi-classes')
    // Go to CAPI > ClusterClass to ensure the clusterclass is created
    cy.checkCAPIClusterClass(classNamePrefix);
  })

  it('Add CAPD cluster fleet repo and get cluster name', () => {
    cypressLib.checkNavIcon('cluster-management').should('exist');
    cy.addFleetGitRepo(clustersRepoName, repoUrl, branch, path);

    // Check CAPI cluster using its name prefix i.e. className
    cy.checkCAPICluster(classNamePrefix);
    // Get the cluster name by its prefix and use it across the test
    cy.getBySel('sortable-cell-0-1').then(($cell) => {
      clusterName = $cell.text();
      cy.log('CAPI Cluster Name:', clusterName);
    });
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

  it('Install App on imported cluster', () => {
    // Click on imported CAPD cluster
    cy.contains(clusterName).click();

    // Install Chart
    // We install Logging chart instead of Monitoring, since this is relatively lightweight.
    cy.checkChart('Install', 'Logging', 'cattle-logging-system');
  })

  if (skipClusterDeletion) {
    it('Remove imported CAPD cluster from Rancher Manager and Delete the CAPD cluster', {retries: 1}, () => {
      // Delete the imported cluster
      // Ensure that the provisioned CAPI cluster still exists
      // this check can fail, ref: https://github.com/rancher/turtles/issues/1587
      importedRancherClusterDeletion(clusterName);
      // Remove CAPI Resources related to the cluster
      capiClusterDeletion(clusterName, timeout, clustersRepoName, true);
    })

    it('Delete the ClusterClass fleet repo', () => {
      // Remove the clusterclass repo
      cy.removeFleetGitRepo(clusterClassRepoName);
      // Cleanup other resources
      cy.deleteKubernetesResource('local', ['Storage', 'Secrets'], 'capd-docker-token', capiClustersNS)
    })
  }
});
