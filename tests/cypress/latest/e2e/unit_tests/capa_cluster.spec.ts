import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';

Cypress.config();
describe('Import CAPA', () => {
  const timeout = 1200000
  const repoName = 'clusters'
  const clusterShort = "turtles-qa-cluster"
  const clusterFull = "turtles-qa-cluster-capi"
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
      cy.contains('Provisioned ' + clusterShort, { timeout: timeout });
    })
  );

  it('Auto import child CAPA cluster', () => {
    // Check child cluster is created and auto-imported
    cy.visit('/');
    cy.contains('Pending ' + clusterFull);

    // Check cluster is Active
    cy.clickButton('Manage');
    cy.contains('Active ' + clusterFull, { timeout: 300000 });
  })

  it('Install App on imported cluster', { retries: 1 }, () => {
    // Click on imported CAPA cluster
    cy.contains(clusterFull).click();

    // Install App
    cy.installApp('Monitoring', 'cattle-monitoring');
  })

  qase(15,
    it('Remove imported CAPA cluster from Rancher Manager', () => {

      // Check cluster is not deleted after removal
      cy.deleteCluster(clusterFull);
      cy.visit('/');
      cypressLib.burgerMenuToggle();
      cy.checkCAPIMenu();
      cy.contains('Provisioned ' + clusterShort);
    })
  );

  qase(16,
    it('Delete the CAPA cluster fleet repo', () => {

      // Remove the fleet git repo
      cy.removeFleetGitRepo(repoName)
      // Wait until the following returns no clusters found:
      // kubectl get clusters.cluster.x-k8s.io
      // This is checked by ensuring the cluster is not available in navigation menu and CAPI menu
      cy.contains(clusterFull, { timeout: timeout }).should('not.exist');
      cypressLib.burgerMenuToggle();
      cy.accesMenuSelection('Cluster Management', 'CAPI');
      cy.getBySel('button-group-child-1').click();
      cy.get('.input-sm')
        .click()
        .type(clusterShort);
      cy.contains(clusterShort, { timeout: timeout }).should('not.exist');
    })
  );

});
