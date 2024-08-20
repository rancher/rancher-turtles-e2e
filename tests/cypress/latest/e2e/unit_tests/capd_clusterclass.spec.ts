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

Cypress.config();
describe('Import CAPD Clusterclass', () => {
  const timeout = 300000
  const repoNames = ['classes' ,'clusters']
  const clusterName = "cluster1"
  const repoUrl = "https://github.com/rancher/rancher-turtles-e2e.git"
  const basePath = "/tests/assets/rancher-turtles-fleet-example/"
  const path = 'clusterclass_autoimport'
  const branch = "main"

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  // TODO: Add QASE IDs
  repoNames.forEach((repo) => {
    it('Add clusterclass fleet repo - ' + repo, () => {
      cypressLib.checkNavIcon('cluster-management').should('exist');
      var fullPath = basePath.concat(path, '/', repo)
      cy.addFleetGitRepo(repo, repoUrl, branch, fullPath);
      cy.contains(repo).click();
    })
  })

  it('Auto import child CAPD cluster', () => {
    // Check child cluster is created and auto-imported
    cy.goToHome();
    cy.contains('Pending ' + clusterName, { timeout: timeout });

    // Check cluster is Active
    cy.clickButton('Manage');
    cy.contains('Active ' + clusterName, { timeout: timeout });
    // TODO: Check MachineSet unavailable status and use checkCAPIClusterActive
    cy.checkCAPIClusterProvisioned(clusterName);
  })

  it('Install App on imported cluster', { retries: 1 }, () => {
    // Click on imported CAPD cluster
    cy.contains(clusterName).click();

    // Install App
    cy.installApp('Monitoring', 'cattle-monitoring');
  })

  it('Scale down imported CAPD cluster', () => {
    // Access CAPI cluster
    cy.checkCAPIMenu();
    cy.contains("Machine Deployments").click();
    cy.getBySel('sortable-table-0-action-button').click();
    cy.contains('Edit YAML')
      .click();
    cy.get('.CodeMirror')
      .then((editor) => {
        var text = editor[0].CodeMirror.getValue();
        text = text.replace(/replicas: 3/g, 'replicas: 2');
        editor[0].CodeMirror.setValue(text);
        cy.clickButton('Save');
      })
    // Check CAPI cluster status
    cy.contains('Machine Deployments').click();
    cy.get('.content > .count', { timeout: timeout }).should('have.text', '2');
    cy.checkCAPIClusterActive(clusterName);
  })

  it('Remove imported CAPD cluster from Rancher Manager', { retries: 1 }, () => {
    // Check cluster is not deleted after removal
    cy.deleteCluster(clusterName);
    cy.goToHome();
    // kubectl get clusters.cluster.x-k8s.io
    // This is checked by ensuring the cluster is not available in navigation menu
    cy.contains(clusterName).should('not.exist');
    cy.checkCAPIClusterProvisioned(clusterName);
  })

  it('Delete the clusterclass fleet repo - ' + path, () => {
    // Remove the classes fleet git repo
    cy.removeFleetGitRepo(repoNames.at(0), true)

    // Remove the cluster fleet git repo
    cypressLib.burgerMenuToggle();
    cy.removeFleetGitRepo(repoNames.at(-1))
    // Wait until the following returns no clusters found
    
    // This is checked by ensuring the cluster is not available in CAPI menu
    cypressLib.burgerMenuToggle();
    cy.checkCAPIMenu();
    cy.getBySel('button-group-child-1').click();
    cy.typeInFilter(clusterName);
    cy.getBySel('sortable-table-0-action-button', { timeout: timeout }).should('not.exist');
    // Ensure the cluster is not available in navigation menu
    cy.getBySel('side-menu').then(($menu) => {
      if ($menu.text().includes(clusterName)) {
        cy.deleteCluster(clusterName);
      }
    })
  })

});
