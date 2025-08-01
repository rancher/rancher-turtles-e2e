import '~/support/commands';
import * as randomstring from 'randomstring';
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipClusterDeletion } from '~/support/utils';

Cypress.config();
describe('Import CAPZ RKE2 Class-Cluster', { tags: '@full' }, () => {
  const separator = '-'
  const timeout = 1200000
  const namespace = 'capz-system'
  const classNamePrefix = 'azure-rke2'
  const clusterName = 'turtles-qa'.concat(separator, classNamePrefix, separator, randomstring.generate({ length: 4, capitalization: 'lowercase' }), separator, Cypress.env('cluster_user_suffix'))
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/azure/rke2'
  const clusterClassRepoName = classNamePrefix + '-clusterclass'
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

  it('Create AzureClusterIdentity', () => {
    cy.createAzureClusterIdentity(clientID, tenantID, clientSecret)
  })

  qase(87, it('Add CAPZ RKE2 ClusterClass Fleet Repo and check Azure CCM', () => {
    cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath, 'capi-classes')
    // Go to CAPI > ClusterClass to ensure the clusterclass is created
    cy.checkCAPIClusterClass(classNamePrefix);

    // Navigate to `local` cluster, More Resources > Fleet > Helm Apps and ensure the charts are active.
    cy.burgerMenuOperate('open');
    cy.contains('local').click();
    cy.accesMenuSelection(['More Resources', 'Fleet', 'HelmApps']);
    ["azure-ccm", "calico-cni"].forEach((app) => {
      cy.typeInFilter(app);
      cy.getBySel('sortable-cell-0-1').should('exist');
    })
  })
  );

  qase(78,
    it('Import CAPZ RKE2 class-cluster using YAML', () => {
      cy.readFile('./fixtures/azure/capz-rke2-class-cluster.yaml').then((data) => {
        data = data.replace(/replace_cluster_name/g, clusterName)
        data = data.replace(/replace_subscription_id/g, subscriptionID)
        cy.importYAML(data, 'capi-clusters')
      });
      // Check CAPI cluster using its name
      cy.checkCAPICluster(clusterName);
    })
  );

  qase(79, it('Auto import child CAPZ RKE2 cluster', () => {
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

  qase(80, it('Install App on imported cluster', () => {
    // Click on imported CAPZ cluster
    cy.contains(clusterName).click();

    // Install Chart
    // We install Logging chart instead of Monitoring, since this is relatively lightweight.
    cy.checkChart('Install', 'Logging', 'cattle-logging-system');
  })
  );

  it("Scale up imported CAPZ cluster by patching class-cluster yaml", () => {
    cy.readFile('./fixtures/azure/capz-rke2-class-cluster.yaml').then((data) => {
      data = data.replace(/replicas: 2/g, 'replicas: 3')

      // workaround; these values need to be re-replaced before applying the scaling changes
      data = data.replace(/replace_cluster_name/g, clusterName)
      data = data.replace(/replace_subscription_id/g, subscriptionID)
      cy.importYAML(data, 'capi-clusters')

      // Check CAPI cluster status
      cy.checkCAPIMenu();
      cy.contains('Machine Deployments').click();
      cy.typeInFilter(clusterName);
      cy.get('.content > .count', { timeout: timeout }).should('have.text', '3');
      cy.checkCAPIClusterActive(clusterName);
    })
  })

  if (skipClusterDeletion) {
    qase(82,
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

    qase(83, it('Delete the ClusterClass fleet repo and other resources', () => {
      // Remove the clusterclass repo
      cy.removeFleetGitRepo(clusterClassRepoName);

      // Delete secret and AzureClusterIdentity
      cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'AzureClusterIdentities'], 'cluster-identity', 'capi-clusters')
      cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'cluster-identity', namespace)
    })
    );
  }

});
