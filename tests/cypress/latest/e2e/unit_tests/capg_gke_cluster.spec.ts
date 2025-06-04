import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipClusterDeletion } from '~/support/utils';

Cypress.config();
describe('Import CAPG GKE Cluster', { tags: '@full' }, () => {
  var clusterName: string
  const timeout = 1200000
  const repoName = 'clusters-gcp-gke'
  const clusterNamePrefix = 'turtles-qa-gcp-gke' // as per fleet values
  const branch = 'main'
  const path = '/tests/assets/rancher-turtles-fleet-example/capg/gke/clusters'
  const repoUrl = 'https://github.com/rancher/rancher-turtles-e2e.git'
  const gcpProject = Cypress.env("gcp_project")
  const namespace = 'capg-system'

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  it('Create the helm values secret', () => {
    cy.contains('local')
      .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
      .click();
    cy.contains('Import YAML');
    cy.readFile('./fixtures/capg-helm-values-secret.yaml').then((data) => {
      cy.get('.CodeMirror')
        .then((editor) => {
          data = data.replace(/replace_gcp_project/g, gcpProject)
          editor[0].CodeMirror.setValue(data);
        })
    });
    cy.clickButton('Import');
    cy.clickButton('Close');
  })

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Enable');
  })

  qase(34,
    it('Add CAPG cluster fleet repo and get cluster name', () => {
      cypressLib.checkNavIcon('cluster-management')
        .should('exist');

      // Add CAPG fleet repository
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

  qase(36,
    it('Auto import child CAPG cluster', () => {
      // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
      cy.checkCAPIClusterProvisioned(clusterName, timeout);

      // Check child cluster is created and auto-imported
      // This is checked by ensuring the cluster is available in navigation menu
      cy.goToHome();
      cy.contains(clusterName).should('exist');

      // Check cluster is Active
      cy.searchCluster(clusterName);
      cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });
    })
  );

  qase(37,
    it('Install App on imported cluster', () => {
      // Click on imported CAPG cluster
      cy.contains(clusterName).click();

      // Install Chart
      // We install Logging chart instead of Monitoring, since this is relatively lightweight.
      cy.checkChart('Install', 'Logging', 'cattle-logging-system');
    })
  );

  if (skipClusterDeletion) {
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
        cy.removeFleetGitRepo(repoName);
        // Wait until the following returns no clusters found
        // This is checked by ensuring the cluster is not available in CAPI menu
        // cy.checkCAPIClusterDeleted(clusterName, timeout);

        // Due to https://github.com/kubernetes-sigs/cluster-api-provider-gcp/issues/1454, the cluster is forever in deleting state; we only check that the cluster is in `Deleting` state until the fix is released, which should be somewhere around June 2025
        cy.exploreCluster('local');
        ["GCPManagedClusters", "GCPManagedControlPlanes"].forEach((resource) => {
          cy.accesMenuSelection(['More Resources', 'Cluster Provisioning', resource])
          cy.typeInFilter(clusterName);
          cy.getBySel('sortable-cell-0-1', { timeout: timeout }).should('not.exist');
        })
      })
    );

    it('Delete the helm values secret', () => {
      cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], "capg-helm-values", namespace)
    })
  }
});
