import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import * as randomstring from "randomstring";
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipClusterDeletion } from '~/support/utils';

Cypress.config();
describe('Import/Create CAPZ', { tags: '@full' }, () => {
  const timeout = 1200000
  const repoName = 'clusters-capz-aks'
  const className = 'capz-aks-class'
  const clusterNamePrefix = className + '-cluster'
  const clusterName = clusterNamePrefix + randomstring.generate({ length: 4, capitalization: "lowercase" })
  const machineName = 'default-system'
  const k8sVersion = 'v1.30.0'
  const podCIDR = '192.168.0.0/16'
  const branch = 'main'
  const path = '/tests/assets/rancher-turtles-fleet-example/capz/aks/classes'
  const repoUrl = "https://github.com/rancher/rancher-turtles-e2e.git"
  const clientID = Cypress.env("azure_client_id")
  const clientSecret = btoa(Cypress.env("azure_client_secret"))
  const subscriptionID = Cypress.env("azure_subscription_id")
  const tenantID = Cypress.env("azure_tenant_id")
  const location = Cypress.env("azure_location")

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Enable');
  })


  it('Create azure cluster identity Secret', () => {
    cy.createAzureClusterIdentitySecret(clientSecret)
  })

  it('Create values.yaml Secret', () => {
    cy.createCAPZValuesSecret(location, clientID, tenantID, subscriptionID)
  })

  it('Create AzureClusterIdentity', () => {
    cy.createAzureClusterIdentity(clientID, tenantID)
  })

  qase(21, it('Add CAPZ classes fleet repo', () => {
    cypressLib.checkNavIcon('cluster-management').should('exist');

    // Add CAPZ fleet repository
    cy.addFleetGitRepo(repoName, repoUrl, branch, path);
  })
  );


  qase(44, it('Create CAPZ from Clusterclass', () => {
    // Create cluster from Clusterclass UI
    cy.createCAPICluster(className, clusterName, machineName, k8sVersion, podCIDR);
    cy.checkCAPIMenu();
    cy.contains(new RegExp('Provisioned.*' + clusterName), { timeout: timeout });

    // Check child cluster is auto-imported
    cy.searchCluster(clusterName);
    cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });
  })
  );

  qase(23, it('Install App on imported cluster', { retries: 1 }, () => {
    // Click on imported CAPZ cluster
    cy.contains(clusterName).click();

    // Install Chart
    cy.checkChart('Install', 'Monitoring', 'cattle-monitoring');
  })
  );

  if (skipClusterDeletion) {
    qase(26, it('Delete the CAPZ cluster fleet repo', () => {

      // Remove the fleet git repo
      cy.removeFleetGitRepo(repoName, true);
      // Wait until the following returns no clusters found
      // This is checked by ensuring the cluster is not available in CAPI menu
      cy.checkCAPIClusterDeleted(clusterName, timeout);
      // Remove the clusterclass
      cy.removeCAPIResource('Cluster Classes', className);
    })
    );
  }

});
