import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';

Cypress.config();
describe('Import CAPG GKE', { tags: '@full' }, () => {
  const timeout = 1200000
  const repoName = 'clusters'
  const clusterName = 'turtles-qa'
  const branch = 'fleet-example'
  const path = '/tests/assets/rancher-turtles-fleet-example/capg/gke'
  const repoUrl = 'https://github.com/rancher/rancher-turtles-e2e.git'

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Enable');
  })

  qase(34,
    it('Add CAPG cluster fleet repo', () => {
      cypressLib.checkNavIcon('cluster-management')
        .should('exist');

      // Add CAPG fleet repository
      cy.addFleetGitRepo(repoName, repoUrl, branch, path);

      // Go to Cluster Management > CAPI > Clusters and check if the cluster has started provisioning
      cy.checkCAPIMenu();
      cy.contains(new RegExp('Provisioned.*' + clusterName), { timeout: timeout });
    })
  );

  qase(36,
    it('Auto import child CAPG cluster', () => {
      // Check child cluster is created  and auto-imported
      cy.goToHome();
      cy.contains(new RegExp('Pending.*' + clusterName));

      // Check cluster is Active
      cy.searchCluster(clusterName);
      cy.contains(new RegExp('Active.*' + clusterName), { timeout: 300000 });
    })
  );

  qase(37,
    it('Install App on imported cluster', { retries: 1 }, () => {
      // Click on imported CAPG cluster
      cy.contains(clusterName).click();

      // Install Chart
      cy.checkChart('Install', 'Monitoring', 'cattle-monitoring');
    })
  );

  qase(38,
    it('Remove imported CAPG cluster from Rancher Manager', { retries: 1 }, () => {

      // Check cluster is not deleted after removal
      cy.deleteCluster(clusterName);
      cy.goToHome();
      // kubectl get clusters.cluster.x-k8s.io
      // This is checked by ensuring the cluster is not available in navigation menu
      cy.contains(clusterName).should('not.exist');
      cy.checkCAPIClusterProvisioned(clusterName);
    })
  );

  qase(39,
    it('Delete the CAPG cluster fleet repo', () => {

      // Remove the fleet git repo
      cy.removeFleetGitRepo(repoName)
      // Wait until the following returns no clusters found
      // This is checked by ensuring the cluster is not available in CAPI menu
      cy.checkCAPIClusterDeleted(clusterName, timeout);
    })
  );

});
