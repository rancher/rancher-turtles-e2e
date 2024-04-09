import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';

Cypress.config();
describe('Import CAPA', () => {
  const timeout = 1200000
  const repoName = 'clusters'
  const clusterShort = "pvala-cluster"
  const clusterFull = "pvala-cluster-capi"
  const branch = 'aws'
  const repoUrl = "https://github.com/valaparthvi/rancher-turtles-fleet-example.git"

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  qase(14,
    it('Import CAPA cluster using fleet', () => {
      cypressLib.checkNavIcon('cluster-management')
        .should('exist');

      // Add CAPA fleet repository
      cy.addFleetGitRepo({ repoName, repoUrl, branch });
      cy.contains(repoName).click();
    })
  );

  qase(15,
    it('Auto import child CAPA cluster', () => {
      // cy.namespaceAutoImport('Enable');

      // Check child cluster is created and auto-imported
      cy.visit('/');
      cy.contains('Pending ' + clusterFull, { timeout: timeout });

      // Check cluster is Active
      cy.clickButton('Manage');
      cy.contains('Active ' + clusterFull, { timeout: 300000 });
      cypressLib.burgerMenuToggle();
      cy.accesMenuSelection('Cluster Management', 'CAPI');
      cy.contains('CAPI Clusters').click();
      cy.contains('Provisioned ' + clusterShort, { timeout: 30000 });
    })
  );

  qase(16,
    it('Install App on imported cluster', () => {

      // Click on imported CAPA cluster
      cy.contains(clusterFull).click();

      // Install App
      cy.installApp('Monitoring', 'cattle-monitoring');
    })
  );

  qase(18,
    it('Remove imported CAPA cluster from Rancher Manager', () => {

      // Check cluster is not deleted after removal
      cy.deleteCluster(clusterFull);
      cy.visit('/');
      cypressLib.burgerMenuToggle();
      cy.accesMenuSelection('Cluster Management', 'CAPI');
      cy.contains('CAPI Clusters').click();
      cy.contains('Provisioned ' + clusterShort, { timeout: timeout });
    })
  );

  qase(19,
    it('Delete the CAPA cluster fleet repo', () => {

      // Remove the fleet git repo
      cy.removeFleetGitRepo(repoName)
      // Wait until the following returns no clusters found:
      // kubectl get clusters.cluster.x-k8s.io
      // This is checked by ensuring the cluster is not available in navigation menu and CAPI menu
      cy.contains(clusterFull, { timeout: timeout }).should('not.exist');
      cypressLib.burgerMenuToggle();
      cy.accesMenuSelection('Cluster Management', 'CAPI');
      cy.contains('CAPI Clusters').click();
      cy.contains(clusterShort).should('not.exist', { timeout: timeout });
    })
  );

});
