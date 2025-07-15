import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipClusterDeletion } from '~/support/utils';

Cypress.config();
describe('Import CAPA Kubeadm Cluster', { tags: '@full' }, () => {
  var clusterName: string
  const timeout = 1200000
  const repoName = 'clusters-aws-kb'
  const clusterNamePrefix = 'turtles-qa-aws-kb' // as per fleet values
  const branch = 'main'
  const path = '/tests/assets/rancher-turtles-fleet-example/capa/kubeadm/clusters'
  const repoUrl = 'https://github.com/rancher/rancher-turtles-e2e.git'

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Enable');
  })

  it('Check CAPA Kubeadm Applications', () => {
    // Navigate to `local` cluster, More Resources > Fleet > Helm Apps and ensure the charts are active.
    cy.burgerMenuOperate('open');
    cy.contains('local').click();
    cy.accesMenuSelection(['More Resources', 'Fleet', 'HelmApps']);
    ['aws-ccm', 'aws-csi-driver', 'calico-cni-aws'].forEach((app) => {
      cy.typeInFilter(app);
      cy.getBySel('sortable-cell-0-1').should('exist');
    })
  })

  qase(118,
    it('Add CAPA clusters fleet repo and get cluster name', () => {
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

  qase(119,
    it('Auto import child CAPA cluster', () => {
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
  );

  qase(120,
    it('Install App on imported cluster', () => {
      // Click on imported CAPA cluster
      cy.contains(clusterName).click();

      // Install Chart
      // We install Logging chart instead of Monitoring, since this is relatively lightweight.
      cy.checkChart('Install', 'Logging', 'cattle-logging-system');
    })
  );

  if (skipClusterDeletion) {
    qase(121,
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

    qase(122,
      it('Delete the CAPA cluster and Apps fleet repo', () => {
        // Remove the fleet git repo
        cy.removeFleetGitRepo(repoName);
        // Wait until the following returns no clusters found
        // This is checked by ensuring the cluster is not available in CAPI menu
        cy.checkCAPIClusterDeleted(clusterName, timeout);
      })
    );
  }
});
