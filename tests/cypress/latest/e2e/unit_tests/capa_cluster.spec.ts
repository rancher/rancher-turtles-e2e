import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';

Cypress.config();
describe('Import CAPA', () => {
  const timeout = 1200000
  const repoName = 'clusters'
  const clusterName = "turtles-qa-cluster"
  const branch = 'main'
  const path = '/tests/assets/rancher-turtles-fleet-example/aws'
  const repoUrl = "https://github.com/rancher/rancher-turtles-e2e.git"

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Enable');
  })

  qase(14,
    it('Add CAPA cluster fleet repo', () => {
      cypressLib.checkNavIcon('cluster-management')
        .should('exist');

      // Add CAPA fleet repository
      cy.addFleetGitRepo({ repoName, repoUrl, branch, path });
      cy.contains(repoName).click();

      // Go to Cluster Management > CAPI > Clusters and check if the cluster has started provisioning
      cypressLib.burgerMenuToggle();
      cy.checkCAPIMenu();
      cy.contains('Provisioned ' + clusterName, { timeout: timeout });
    })
  );

  it('Auto import child CAPA cluster', () => {
    // Check child cluster is created and auto-imported
    cy.visit('/');
    cy.contains('Pending ' + clusterName);

    // Check cluster is Active
    cy.clickButton('Manage');
    cy.contains('Active ' + clusterName, { timeout: 300000 });
  })

  it('Install App on imported cluster', { retries: 1 }, () => {
    // Click on imported CAPA cluster
    cy.contains(clusterName).click();

    // Install App
    cy.installApp('Monitoring', 'cattle-monitoring');
  })

  qase(15,
    it('Remove imported CAPA cluster from Rancher Manager', { retries: 1 }, () => {

      // Check cluster is not deleted after removal
      cy.deleteCluster(clusterName);
      cy.visit('/');
      // kubectl get clusters.cluster.x-k8s.io
      // This is checked by ensuring the cluster is not available in navigation menu
      cy.contains(clusterName).should('not.exist');
      cy.checkCAPIClusterProvisioned(clusterName);
    })
  );

  qase(16,
    it('Delete the CAPA cluster fleet repo', () => {

      // Remove the fleet git repo
      cy.removeFleetGitRepo(repoName)
      // Wait until the following returns no clusters found
      // This is checked by ensuring the cluster is not available in CAPI menu
      cypressLib.burgerMenuToggle();
      cy.checkCAPIMenu();
      cy.getBySel('button-group-child-1').click();
      cy.typeInFilter(clusterName);
      cy.getBySel('sortable-table-0-action-button', { timeout: timeout }).should('not.exist');
    })
  );

});
