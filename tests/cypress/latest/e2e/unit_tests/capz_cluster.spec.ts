import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipClusterDeletion } from '~/support/utils';

Cypress.config();
describe('Import/Create CAPZ', { tags: '@full' }, () => {
  var clusterName: string
  const timeout = 1200000
  const repoName = 'clusters-capz-aks'
  const clusterNamePrefix = 'turtles-qa-azure-aks' // as per fleet values
  const branch = 'aws-rke2-class'
  const k8sVersion = 'v1.31.4'
  const path = '/tests/assets/rancher-turtles-fleet-example/capz/aks/clusters'
  const repoUrl = "https://github.com/rancher/rancher-turtles-e2e.git"
  const clientID = Cypress.env("azure_client_id")
  const clientSecret = btoa(Cypress.env("azure_client_secret"))
  const subscriptionID = Cypress.env("azure_subscription_id")
  const tenantID = Cypress.env("azure_tenant_id")
  const location = Cypress.env("azure_location")
  const namespace = 'capz-system'

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Enable');
  })

  it('Create values.yaml Secret', () => {
    cy.createCAPZValuesSecret(location, clientID, tenantID, subscriptionID, k8sVersion);
  })

  it('Create AzureClusterIdentity', () => {
    cy.createAzureClusterIdentity(clientSecret, clientID, tenantID);
  })

  qase(21, it('Add CAPZ cluster fleet repo and get cluster name', () => {
    cypressLib.checkNavIcon('cluster-management')
      .should('exist');

    // Add CAPZ fleet repository
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

  qase(22, it('Auto import child CAPZ cluster', () => {
    // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
    cy.checkCAPIClusterProvisioned(clusterName, timeout);

    // Check child cluster is created and auto-imported
    cy.goToHome();
    cy.contains(new RegExp('Pending.*' + clusterName));

    // Check cluster is Active
    cy.searchCluster(clusterName);
    cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });
  })
  );
  qase(23, it('Install App on imported cluster', { retries: 1 }, () => {
    // Click on imported CAPZ cluster
    cy.contains(clusterName).click();

    // Install Chart
    cy.checkChart('Install', 'Logging', 'cattle-logging-system');
  })
  );

  qase(25, it('Remove imported CAPZ cluster from Rancher Manager and Delete the CAPZ cluster', { retries: 1 }, () => {

    // Check cluster is not deleted after removal
    cy.deleteCluster(clusterName);
    cy.goToHome();
    // kubectl get clusters.cluster.x-k8s.io
    // This is checked by ensuring the cluster is not available in navigation menu
    cy.contains(clusterName).should('not.exist');
    cy.checkCAPIClusterProvisioned(clusterName);

    // Delete CAPI cluster created from Fleet
    cy.removeCAPIResource('Clusters', clusterName, timeout);
  })
  );

  if (skipClusterDeletion) {
    qase(26, it('Delete the CAPZ cluster fleet repo and other resources', () => {

      // Remove the fleet git repo
      cy.removeFleetGitRepo(repoName);
      // Wait until the following returns no clusters found
      // This is checked by ensuring the cluster is not available in CAPI menu
      cy.checkCAPIClusterDeleted(clusterName, timeout);
    })
    );

    it('Delete the secrets', () => {
      ["azure-creds-secret", "cluster-identity-secret"].forEach((resourceName) => {
        cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], resourceName, namespace)
      })
    })

    it('Delete AzureClusterIdentities resource', { retries: 1 }, () => {
      // This test can be flaky, so it is in a separate test.
      cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'AzureClusterIdentities'], 'cluster-identity', 'default')
    })
  }

});
