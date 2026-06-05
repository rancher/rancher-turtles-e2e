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

import '../support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import {isUseCAAPFSupported, skipClusterDeletion, isRancherManagerVersion} from '../support/utils';
import {capdResourcesCleanup, capiClusterDeletion, importedRancherv3ClusterDeletion} from "../support/cleanup_support";
import {vars} from '../support/variables';

Cypress.config();
describe('Import CAPD RKE2 (Default CNI) Class-Cluster using Fleet', {tags: '@short'}, () => {
  let clusterName: string
  const timeout = vars.shortTimeout
  const classNamePrefix = 'docker-rke2'
  const path = '/tests/assets/rancher-turtles-fleet-example/capd/rke2/class-clusters-v1beta1'
  const classesPath = 'examples/clusterclasses/docker/rke2'
  const clustersRepoName = 'docker-rke2-class-clusters'
  const clusterClassRepoName = "docker-rke2-clusterclass"

  beforeEach(function () {
    if (isUseCAAPFSupported) {
      // This test is only meant for <2.14.1
      this.skip();
    }
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('[SETUP]', () => {
    qase(427, it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    })
    );

    qase(428, it('Create Docker Auth Secret', () => {
      // Prevention for Docker.io rate limiting
      cy.createDockerAuthSecret();
    })
    );

    qase(429, it('Add CAPD RKE2 ClusterClass Fleet Repo', () => {
      cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(classNamePrefix);
    })
    );
  })

  context('[CLUSTER-IMPORT]', () => {
    qase(430, it('Add CAPD cluster fleet repo and get cluster name', () => {
      cypressLib.checkNavIcon('cluster-management').should('exist');
      cy.addFleetGitRepo(clustersRepoName, vars.repoUrl, vars.branch, path);

      // Check CAPI cluster using its name prefix i.e. className
      cy.checkCAPICluster(classNamePrefix);
      // Get the cluster name by its prefix and use it across the test
      cy.getBySel('sortable-cell-0-1').then(($cell) => {
        clusterName = $cell.text();
        cy.task('suiteLog',`CAPI Cluster Name: ${clusterName}`);
      });
    })
    );

    qase(437, it('Auto import child CAPD cluster', () => {
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
    qase(452, it('Check RKE2 Default CNI', () => {
      cy.contains(clusterName).click();
      cy.accesMenuSelection(['Workloads', 'Pods']);
      cy.setNamespace('All Namespaces', 'all_user');
      // Filter out cni pods by image name
      cy.typeInFilter('calico');
      cy.waitForAllRowsInState('Running', timeout);
    })
    );

    qase(432, (isRancherManagerVersion('>2.14') ? it.skip : it)('Install App on imported cluster', {retries: 1}, () => {
      cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
    })
    );
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
      qase(433, it('Remove imported CAPD cluster from Rancher Manager', () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        importedRancherv3ClusterDeletion(clusterName);
      })
      );

      qase(434, it('Delete the CAPD cluster', {retries: 1}, () => {
        // Remove CAPI Resources related to the cluster
        capiClusterDeletion(clusterName, timeout, clustersRepoName, true);
      })
      );

      qase(435, it('Delete the ClusterClass fleet repo', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);
        // Cleanup other resources
        capdResourcesCleanup();
      })
      );
    }
  })
});
