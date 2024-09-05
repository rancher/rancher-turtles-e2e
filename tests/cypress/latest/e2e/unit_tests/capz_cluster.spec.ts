import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';

Cypress.config();
describe('Import CAPA', () => {
  const timeout = 1200000
  const repoName = 'clusters'
  const clusterName = "turtles-qa-capz"
  const branch = 'automate-capz'
  const path = '/tests/assets/rancher-turtles-fleet-example/azure/helmchart'
  const repoUrl = "https://github.com/rancher/rancher-turtles-e2e.git"
  // const cmFilePath = "/tests/assets/rancher-turtles-fleet-example/azure/values-configmap.yaml"
  const clientID = "azure_client_id"
  const clientSecret = "azure_client_secret"
  const subscriptionID = "azure_subscription_id"
  const tenantID = "azure_tenant_id"

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Enable');
  })

  it('Create azure cluster identity Secret', () => {
    //  Creating this seperately ensures that the cluster is deleted successfully. (to be tested)
    cy.contains('local')
      .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
      .click();
    cy.contains('Import YAML');
    cy.readFile('./fixtures/capz-client-secret.yaml').then((data) => {
      cy.get('.CodeMirror')
        .then((editor) => {
          data.replace(/$clientSecret/g, Cypress.env(clientSecret))
          editor[0].CodeMirror.setValue(data);
        })
    });
    cy.clickButton('Import');
    cy.clickButton('Close');
  })

  it('Create values.yaml ConfigMap', () => {
    // Replace assets/rancher-turtles-fleet-example/azure/values-configmap.yaml with the env vars and create the configmap, perhaps by importing the YAML
    cy.contains('local')
      .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
      .click();
    cy.contains('Import YAML');
    cy.readFile('./fixtures/capz-helm-values-cm.yaml').then((data) => {
      cy.get('.CodeMirror')
        .then((editor) => {
          data.replace(/$clientID/g, Cypress.env(clientID))
          data.replace(/$tenantID/g, Cypress.env(tenantID))
          data.replace(/$subscriptionID/g, Cypress.env(subscriptionID))
          editor[0].CodeMirror.setValue(data);
        })
    });
    cy.clickButton('Import');
    cy.clickButton('Close');
  })

  qase(14,
    it('Add CAPZ cluster fleet repo', () => {
      // TODO: Consider using kubectl instead of fleet; will make it easier to test cluster scaling and manage to hide the sensitive information
      cypressLib.checkNavIcon('cluster-management')
        .should('exist');

      // Add CAPA fleet repository
      cy.addFleetGitRepo(repoName, repoUrl, branch, path);
      cy.contains(repoName).click();

      // Go to Cluster Management > CAPI > Clusters and check if the cluster has started provisioning
      cypressLib.burgerMenuToggle();
      cy.checkCAPIMenu();
      cy.contains('Provisioned ' + clusterName, { timeout: timeout });
    })
  );

  it('Auto import child CAPA cluster', () => {
    // Check child cluster is created and auto-imported
    cy.goToHome();
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

  it("Scale up imported CAPZ cluster by updating configmap and forcefully updating the repo", () => {
    // find a way to run kubectl command via cypress kubectl.Run()
    cy.contains('local')
      .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
      .click();
    cy.contains('Import YAML');
    // ./fixtures/capd-rke2-provider.yaml
    cy.readFile('./fixtures/capz-helm-values-cm.yaml').then((data) => {
      cy.get('.CodeMirror')
        .then((editor) => {
          data.replace(/systempoolCount: 1/g, "systempoolCount: 2")
          data.replace(/userpoolCount: 2/g, "userpoolCount: 4")
          editor[0].CodeMirror.setValue(data);
        })
    });
    cy.clickButton('Import');
    cy.clickButton('Close');

    cy.forceUpdateFleetGitRepo(repoName)

    // TODO: check if the cluster is actually updated
  })

  qase(15,
    it('Remove imported CAPZ cluster from Rancher Manager', { retries: 1 }, () => {

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
    it('Delete the CAPZ cluster fleet repo', () => {

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
