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
import {capiClusterDeletion, importedRancherClusterDeletion} from "~/support/cleanup_support";
import {Cluster} from "~/support/structs";

Cypress.config();
describe('Create CAPD', {tags: '@short'}, () => {
  const timeout = 600000
  const className = 'docker-kubeadm-example'
  const clusterName = getClusterName(className)
  const k8sVersion = 'v1.31.4'
  const pathNames = ['kubeadm'] // TODO: Add rke2 path (capi-ui-extension/issues/121)
  const namespace = 'capi-clusters'
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

    it('Add CAPD ClusterClass fleet repo', () => {
      // TODO: Change the targetNamespace to capi-classes to test cross-namespace cluster provisioning (capi-ui-extension/issues/111)
      cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath + path, namespace)
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(className);
    })

    qase(44,
      it('Create child CAPD cluster from Clusterclass', () => {

        const cluster: Cluster = {
          className: className,
          metadata: {
            namespace: namespace, clusterName: clusterName, k8sVersion: k8sVersion, autoImportCluster: true,
          },
          clusterNetwork: {
            serviceCIDR: [serviceCIDR], podCIDR: ['192.168.0.0/16'], serviceDomain: 'cluster.local'
          },
          controlPlane: {
            replicas: '3'
          },
          workers: [
            {class: 'default-worker', name: 'md-0', replicas: '3'},
          ],
          variables: [
            {
              name: "podSecurityStandard",
              value: `audit: restricted
enabled: false
enforce: baseline
warn: restricted`,
              type: "codeMirror"
            }
          ],
          labels: {
            "cni": "calico",
            "owner": "valaparthvi"
          }
        }
        cy.createCAPICluster(cluster)

        // Ensuring cluster is provisioned also ensures all the Cluster Management > Advanced > Machines for the given cluster are Active.
        cy.checkCAPIClusterActive(clusterName, timeout);
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

      it('Remove the ClusterClass fleet repo', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);
      })
    }
  })
});
