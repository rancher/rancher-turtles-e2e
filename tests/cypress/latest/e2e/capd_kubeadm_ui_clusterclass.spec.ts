/*
Copyright © 2024 - 2025 SUSE LLC
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
import {qase} from 'cypress-qase-reporter/dist/mocha';
import {getClusterName, skipClusterDeletion} from '~/support/utils';
import {capdResourcesCleanup, capiClusterDeletion, importedRancherClusterDeletion} from "~/support/cleanup_support";

Cypress.config();
// TODO: Re-add to suite, rancher-turtles-e2e/issues/256
describe('Create CAPD', { tags: '@skip' }, () => {
  const timeout = 600000
  const className = 'docker-kubeadm-example'
  const clusterName = getClusterName(className)
  const k8sVersion = 'v1.31.4'
  const pathNames = ['kubeadm'] // TODO: Add rke2 path (capi-ui-extension/issues/121)
  const namespace = 'capi-classes' // TODO: Change to capi-clusters (capi-ui-extension/issues/111)
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/docker/'
  const clusterClassRepoName = "docker-ui-clusterclass"

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  pathNames.forEach((path) => {
    let serviceCIDR: string
    if (path.includes('kubeadm')) {
      serviceCIDR = '10.128.0.0/12'
    }

    it('Create Kindnet configmap', () => {
      cy.importYAML('fixtures/kindnet.yaml', namespace);
    })

    it('Add CAPD ClusterClass fleet repo', () => {
      cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath + path, namespace)
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(className);
    })

    qase(44,
      it('Create child CAPD cluster from Clusterclass', () => {
        const machines: Record<string, string> = { 'md-0': 'default-worker' }
        cy.createCAPICluster(className, clusterName, machines, k8sVersion, '192.168.0.0/16', serviceCIDR);

        // Ensuring cluster is provisioned also ensures all the Cluster Management > Advanced > Machines for the given cluster are Active.
        cy.checkCAPIClusterActive(clusterName, timeout);
        cy.clusterAutoImport(clusterName, 'Enable');
        // Check child cluster is auto-imported
        cy.searchCluster(clusterName);
        cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });
      })
    );


    it('Install App on created cluster', () => {
      // Click on imported CAPD cluster
      cy.contains(clusterName).click();
      // Install Chart
      // We install Logging chart instead of Monitoring, since this is relatively lightweight.
      cy.checkChart('Install', 'Logging', 'cattle-logging-system');
    })


    if (skipClusterDeletion) {
      it('Remove imported CAPD cluster and Delete the CAPI resources from Rancher Manager', {retries: 1}, () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        // this check can fail, ref: https://github.com/rancher/turtles/issues/1587
        importedRancherClusterDeletion(clusterName);
        // Remove CAPI Resources related to the cluster
        capiClusterDeletion(clusterName, timeout, undefined, true);
      })

      it('Remove the ClusterClass fleet repo and other resources', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);
        // Cleanup other resources
        capdResourcesCleanup();
      })
    }
  })
});
