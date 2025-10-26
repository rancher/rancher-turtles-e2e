import '~/support/commands';
import {qase} from 'cypress-qase-reporter/mocha';
import {getClusterName, skipClusterDeletion} from '~/support/utils';
import {capiClusterDeletion, capzResourcesCleanup, importedRancherClusterDeletion} from "~/support/cleanup_support";

Cypress.config();
describe('Import CAPZ AKS Class-Cluster', {tags: '@full'}, () => {
  const timeout = 1200000
  const classNamePrefix = 'azure-aks'
  const clusterName = getClusterName(classNamePrefix)
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/azure/aks'
  const clusterClassRepoName = "azure-aks-clusterclass"

  const clientID = Cypress.env("azure_client_id")
  const clientSecret = btoa(Cypress.env("azure_client_secret"))
  const subscriptionID = Cypress.env("azure_subscription_id")
  const tenantID = Cypress.env("azure_tenant_id")

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open')
  });

  context('[SETUP]', () => {
    it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    })

    it('Create AzureClusterIdentity', () => {
      cy.createAzureClusterIdentity(clientID, tenantID, clientSecret);
    })

    qase(84, it('Add CAPZ AKS ClusterClass using fleet', () => {
        cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath, 'capi-classes')
        // Go to CAPI > ClusterClass to ensure the clusterclass is created
        cy.checkCAPIClusterClass(classNamePrefix);
      })
    );
  })

  context('[CLUSTER-IMPORT]', () => {
    qase(55,
      it('Import CAPZ AKS class-cluster using YAML', () => {
        cy.readFile('./fixtures/azure/capz-aks-class-cluster.yaml').then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)
          data = data.replace(/replace_subscription_id/g, subscriptionID)
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
        cy.contains(new RegExp('Active.*' + clusterName), {timeout: timeout});
      })
    );
  })

  context('[CLUSTER-OPERATIONS]', () => {
    qase(57, it('Install App on imported cluster', {retries: 1}, () => {
        // Click on imported CAPZ cluster
        cy.contains(clusterName).click();

        // Install Chart
        cy.checkChart('Install', 'Logging', 'cattle-logging-system');
      })
    );
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
      it('Remove imported CAPZ cluster from Rancher Manager', {retries: 1}, () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        // this check can fail, ref: https://github.com/rancher/turtles/issues/1587
        importedRancherClusterDeletion(clusterName);
      })

      qase(60, it('Delete the CAPZ cluster', () => {
          // Remove CAPI Resources related to the cluster
          capiClusterDeletion(clusterName, timeout);
        })
      );

      it('Delete the ClusterClass fleet repo and other resources', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);
        // Cleanup other resources
        capzResourcesCleanup();
      })
    }
  })
});
