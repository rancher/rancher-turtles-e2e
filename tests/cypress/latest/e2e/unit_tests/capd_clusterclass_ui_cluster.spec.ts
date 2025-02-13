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
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';

Cypress.config();
describe('Create CAPD', { tags: '@short' }, () => {
  const timeout = 300000
  const classesRepo = 'classes'
  const clusterName = 'cluster1'
  const className = 'quick-start'
  const classPath = '/clusterclass/classes'
  const k8sVersion = 'v1.30.3'
  const machineName = 'default-worker'
  const repoUrl = 'https://github.com/rancher/rancher-turtles-e2e.git'
  const basePath = '/tests/assets/rancher-turtles-fleet-example/capd/'
  const pathNames = ['kubeadm'] // TODO: Add rke2_clusterclass_autoimport (capi-ui-extension/issues/121)
  const branch = 'fleet-example'

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  pathNames.forEach((path) => {
    if (path.includes('kubeadm')) {
      var podCIDR = '192.168.0.0/16'
      var serviceCIDR = '10.128.0.0/12'
    }

    it('Add classes fleet repo', () => {
      cypressLib.checkNavIcon('cluster-management').should('exist');
      var fullPath = basePath + path
      // Add classes fleet repo to fleel-local workspace
      fullPath = fullPath.concat('/', classPath)
      cy.addFleetGitRepo(classesRepo, repoUrl, branch, fullPath);
    })

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
        cy.createCAPICluster(className, clusterName, machineName, k8sVersion, podCIDR, serviceCIDR);
        cy.checkCAPIClusterActive(clusterName);
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
      cy.checkChart('Install', 'Monitoring', 'cattle-monitoring');
    })

    it('Remove CAPD cluster from Rancher Manager', { retries: 1 }, () => {
      // Check cluster is not deleted after removal
      cy.deleteCluster(clusterName);
      cy.goToHome();
      // kubectl get clusters.cluster.x-k8s.io
      // This is checked by ensuring the cluster is not available in navigation menu
      cy.contains(clusterName).should('not.exist');
      cy.checkCAPIClusterProvisioned(clusterName);
    })


    it('Delete the CAPI cluster and fleet repo', () => {
      cy.deleteCAPICluster(clusterName, timeout);

      // Remove the classes fleet repo
      cypressLib.burgerMenuToggle();
      cy.removeFleetGitRepo(classesRepo, true);
          
      // Ensure the cluster is not available in navigation menu
      cy.getBySel('side-menu').then(($menu) => {
        if ($menu.text().includes(clusterName)) {
          cy.deleteCluster(clusterName);
        }
      })
    })

  })
});
