import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipDeletionTest } from '~/support/utils';

Cypress.config();
describe('Import CAPG GKE', { tags: '@full' }, () => {
  var clusterName: string
  const timeout = 1200000
  const repoName = 'clusters-capg-gke'
  const clusterNamePrefix = 'turtles-qa-capg-gke' // as per fleet values
  const branch = 'main'
  const path = '/tests/assets/rancher-turtles-fleet-example/capg/gke'
  const repoUrl = 'https://github.com/rancher/rancher-turtles-e2e.git'
  const gcpProject = Cypress.env("gcp_project")

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  it('Create values.yaml Secret', () => {
    cy.contains('local')
      .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
      .click();
    cy.contains('Import YAML');
    var encodedData = ''
    cy.readFile('./fixtures/capg-helm-values.yaml').then((data) => {
      data = data.replace(/replace_gcp_project/g, gcpProject)
      encodedData = btoa(data)
    })

    cy.readFile('./fixtures/capg-helm-values-secret.yaml').then((data) => {
      cy.get('.CodeMirror')
        .then((editor) => {
          data = data.replace(/replace_values/g, encodedData)
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

  if (!skipDeletionTest) {
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
        cy.removeFleetGitRepo(repoName, true);
        // Wait until the following returns no clusters found
        // This is checked by ensuring the cluster is not available in CAPI menu
        cy.checkCAPIClusterDeleted(clusterName, timeout);
      })
    );
  }
});
