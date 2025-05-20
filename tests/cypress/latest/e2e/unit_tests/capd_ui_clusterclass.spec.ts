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
import * as randomstring from "randomstring";
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipClusterDeletion } from '~/support/utils';

Cypress.config();
describe('Create CAPD', { tags: '@short' }, () => {
  const timeout = 600000
  const className = 'docker-kubeadm-example'
  const clusterNamePrefix = className + '-cluster'
  const clusterName = clusterNamePrefix + randomstring.generate({ length: 4, capitalization: "lowercase" })
  const k8sVersion = 'v1.31.4'
  const pathNames = ['kubeadm'] // TODO: Add rke2 path (capi-ui-extension/issues/121)

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  pathNames.forEach((path) => {
    if (path.includes('kubeadm')) {
      var podCIDR = '192.168.0.0/16'
      var serviceCIDR = '10.128.0.0/12'
    }

    it('Create Kindnet configmap', () => {
      cy.contains('local').click();
      cy.getBySel('header-action-import-yaml').click();
      cy.contains('Import YAML');

      cy.readFile('./fixtures/kindnet.yaml').then((data) => {
        cy.get('.CodeMirror')
          .then((editor) => {
            editor[0].CodeMirror.setValue(data);
          })
      })
      cy.clickButton('Import')
      cy.clickButton('Close')
    })

    qase(44,
      it('Create child CAPD cluster from Clusterclass', () => {
        const machines: Record<string, string> = { 'md-0': 'default-worker' }
        cy.createCAPICluster(className, clusterName, machines, k8sVersion, podCIDR, serviceCIDR);
        
        // Ensuring cluster is provisioned also ensures all the Cluster Management > Advanced > Machines for the given cluster are Active.
        cy.checkCAPIClusterActive(clusterName, timeout);
        cy.clusterAutoImport(clusterName, 'Enable');
        // Check child cluster is auto-imported
        cy.searchCluster(clusterName);
        cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });
      })
    );


    it('Install App on created cluster', { retries: 1 }, () => {
      // Click on imported CAPD cluster
      cy.contains(clusterName).click();
      // Install Chart
      // We install Logging chart instead of Monitoring, since this is relatively lightweight.
      cy.checkChart('Install', 'Logging', 'cattle-logging-system');
    })


    if (skipClusterDeletion) {
      it('Remove CAPD cluster from Rancher Manager & Delete the CAPI cluster', { retries: 1 }, () => {
        // Check cluster is not deleted after removal
        cy.deleteCluster(clusterName);
        cy.goToHome();
        // kubectl get clusters.cluster.x-k8s.io
        // This is checked by ensuring the cluster is not available in navigation menu
        cy.contains(clusterName).should('not.exist');
        cy.checkCAPIClusterProvisioned(clusterName);

        cy.removeCAPIResource('Clusters', clusterName, timeout);
        // Ensure the cluster is not available in navigation menu
        cy.getBySel('side-menu').then(($menu) => {
          if ($menu.text().includes(clusterName)) {
            cy.deleteCluster(clusterName);
          }
        })
      })

      it('Delete the Kindnet Config Map', () => {
        cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'ConfigMaps'], "cni-docker-kubeadm-example-crs-0", 'default');
        cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'ClusterResourceSets'], "docker-kubeadm-example-crs-0", 'default');
      })
    }
  })
});
