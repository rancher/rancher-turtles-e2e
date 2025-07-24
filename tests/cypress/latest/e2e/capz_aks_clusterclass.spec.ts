import '~/support/commands';
import * as randomstring from "randomstring";
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipClusterDeletion } from '~/support/utils';

Cypress.config();
describe('Import CAPZ AKS Class-Cluster', { tags: '@full' }, () => {
  const timeout = 1200000
  const namespace = 'capz-system'
  const repoName = 'class-clusters-azure-aks'
  const className = 'azure-aks-example'
  const clusterName = 'turtles-qa-' + className + randomstring.generate({ length: 4, capitalization: "lowercase" })
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/azure/aks'
  const clusterClassRepoName = "azure-aks-clusterclass"
  const providerName = 'azure'

  const clientID = Cypress.env("azure_client_id")
  const clientSecret = btoa(Cypress.env("azure_client_secret"))
  const subscriptionID = Cypress.env("azure_subscription_id")
  const tenantID = Cypress.env("azure_tenant_id")

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open')
  });

  // TODO: Create Provider via UI, ref: capi-ui-extension/issues/128
  it('Create Azure CAPIProvider', () => {
    cy.removeCAPIResource('Providers', providerName);
    cy.createCAPIProvider(providerName);
    cy.checkCAPIProvider(providerName);
  })

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Disable');
  })

  it('Create values.yaml Secret', () => {
    cy.createCAPZValuesSecret(clientID, tenantID, subscriptionID);
  })

  it('Create AzureClusterIdentity', () => {
    cy.createAzureClusterIdentity(clientID, tenantID, clientSecret)
  })

  qase(84, it('Add CAPZ AKS ClusterClass using fleet', () => {
    cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath, 'capi-classes')
    // Go to CAPI > ClusterClass to ensure the clusterclass is created
    cy.checkCAPIClusterClass(className);
  })
  );

  qase(55,
    it('Import CAPZ AKS class-cluster using YAML', () => {
      cy.readFile('./fixtures/azure/capz-aks-class-cluster.yaml').then((data) => {
        data = data.replace(/replace_cluster_name/g, clusterName)
        cy.importYAML(data, 'capi-clusters')
      });
      // Check CAPI cluster using its name
      cy.checkCAPICluster(clusterName);
    })
  );

  qase(56, it('Auto import child CAPZ AKS cluster', () => {
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

  qase(57, it('Install App on imported cluster', () => {
    // Click on imported CAPZ cluster
    cy.contains(clusterName).click();

    // Install Chart
    // We install Logging chart instead of Monitoring, since this is relatively lightweight.
    cy.checkChart('Install', 'Logging', 'cattle-logging-system');
  })
  );


  if (skipClusterDeletion) {
    qase(60,
      it('Remove imported CAPZ cluster from Rancher Manager and Delete the CAPZ cluster', { retries: 1 }, () => {
        // Check cluster is not deleted after removal
        cy.deleteCluster(clusterName);
        cy.goToHome();
        // kubectl get clusters.cluster.x-k8s.io
        // This is checked by ensuring the cluster is not available in navigation menu
        cy.contains(clusterName).should('not.exist');
        cy.checkCAPIClusterProvisioned(clusterName);

        // Delete CAPI cluster
        cy.removeCAPIResource('Clusters', clusterName, timeout);
      })
    );

    qase(89, it('Delete the ClusterClass fleet repo and other resources', () => {
      // Remove the clusterclass repo
      cy.removeFleetGitRepo(clusterClassRepoName);

      // Delete secret and AzureClusterIdentity
      cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'azure-creds-secret', namespace)
      cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'AzureClusterIdentities'], 'cluster-identity', 'capi-clusters')
      cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'cluster-identity', namespace)
    })
    );
  }

});
