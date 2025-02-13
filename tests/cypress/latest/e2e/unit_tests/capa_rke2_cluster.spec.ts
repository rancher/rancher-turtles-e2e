import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';

Cypress.config();
describe('Import CAPA RKE2', { tags: '@full' }, () => {
  var clusterName: string
  const timeout = 1200000
  const repoName = 'clusters-capa-rke2'
  const clusterNamePrefix = 'turtles-qa-capa-rke2' // as per fleet values
  const branch = 'main'
  const path = '/tests/assets/rancher-turtles-fleet-example/capa/rke2'
  const repoUrl = 'https://github.com/rancher/rancher-turtles-e2e.git'

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Enable');
  })

  qase(31,
    it('Add CAPA cluster fleet repo and get cluster name', () => {
      cypressLib.checkNavIcon('cluster-management')
        .should('exist');

      // Add CAPA fleet repository
      cy.addFleetGitRepo(repoName, repoUrl, branch, path);
      // Check CAPI cluster using its name prefix
      cy.checkCAPICluster(clusterNamePrefix);

      // Get the cluster name by its prefix and use it across the test
      cy.getBySel('sortable-cell-0-1').then(($cell) => {
        clusterName = $cell.text();
        cy.log('CAPI Cluster Name:', clusterName);
      });
    })
  );

  it('Auto import child CAPA cluster', () => {
    // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
    cy.checkCAPIClusterProvisioned(clusterName, timeout);

    // Check child cluster is created and auto-imported
    cy.goToHome();
    cy.contains(new RegExp('Pending.*' + clusterName));

    // Check cluster is Active
    cy.searchCluster(clusterName);
    cy.contains(new RegExp('Active.*' + clusterName), { timeout: 300000 });
  })

  qase(32,
    it('Install App on imported cluster', { retries: 1 }, () => {
      // Click on imported CAPA cluster
      cy.contains(clusterName).click();

      // Install Chart
      cy.checkChart('Install', 'Monitoring', 'cattle-monitoring');
    })
  );

  qase(15,
    it('Remove imported CAPA cluster from Rancher Manager', { retries: 1 }, () => {
      // Check cluster is not deleted after removal
      cy.deleteCluster(clusterName);
      cy.goToHome();
      // kubectl get clusters.cluster.x-k8s.io
      // This is checked by ensuring the cluster is not available in navigation menu
      cy.contains(clusterName).should('not.exist');
      cy.checkCAPIClusterProvisioned(clusterName);
    })
  );

  qase(16,
    it('Delete the CAPA cluster fleet repo', () => {
      // Remove the fleet git repo
      cy.removeFleetGitRepo(repoName, true);
      // Wait until the following returns no clusters found
      // This is checked by ensuring the cluster is not available in CAPI menu
      cy.checkCAPIClusterDeleted(clusterName, timeout);
    })
  );
});
