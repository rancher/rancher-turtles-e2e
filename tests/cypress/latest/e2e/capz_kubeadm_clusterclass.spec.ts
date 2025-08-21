import '~/support/commands';
import {getClusterName, skipClusterDeletion} from '~/support/utils';
import {capiClusterDeletion, capzResourcesCleanup, importedRancherClusterDeletion} from "~/support/cleanup_support";

Cypress.config();
describe('Import CAPZ Kubeadm Class-Cluster', { tags: '@full' }, () => {
  const timeout = 1200000
  const classNamePrefix = 'azure-kubeadm'
  const clusterName = getClusterName(classNamePrefix)
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/azure/kubeadm'
  const clusterClassRepoName = "azure-kubeadm-clusterclass"

  const clientID = Cypress.env("azure_client_id")
  const clientSecret = btoa(Cypress.env("azure_client_secret"))
  const subscriptionID = Cypress.env("azure_subscription_id")
  const tenantID = Cypress.env("azure_tenant_id")

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open')
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Disable');
  })

  it('Create AzureClusterIdentity', () => {
    cy.createAzureClusterIdentity(clientID, tenantID, clientSecret)
  })

  it('Add CAPZ Kubeadm ClusterClass Fleet Repo and check Azure CCM', () => {
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
  });

  it('Import CAPZ Kubeadm class-cluster using YAML', () => {
    cy.readFile('./fixtures/azure/capz-kubeadm-class-cluster.yaml').then((data) => {
      data = data.replace(/replace_cluster_name/g, clusterName)
      data = data.replace(/replace_subscription_id/g, subscriptionID)
      cy.importYAML(data, 'capi-clusters')
    });
    // Check CAPI cluster using its name
    cy.checkCAPICluster(clusterName);
  })

  it('Auto import child CAPZ Kubeadm cluster', () => {
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
  });

  it('Install App on imported cluster', () => {
    // Click on imported CAPZ cluster
    cy.contains(clusterName).click();

    // Install Chart
    // We install Logging chart instead of Monitoring, since this is relatively lightweight.
    cy.checkChart('Install', 'Logging', 'cattle-logging-system');
  });

  it("Scale up imported CAPZ cluster by patching class-cluster yaml", () => {
    cy.readFile('./fixtures/azure/capz-kubeadm-class-cluster.yaml').then((data) => {
      data = data.replace(/replicas: 2/g, 'replicas: 3')

      // workaround; these values need to be re-replaced before applying the scaling changes
      data = data.replace(/replace_cluster_name/g, clusterName)
      data = data.replace(/replace_subscription_id/g, subscriptionID)
      cy.importYAML(data, 'capi-clusters')
    })

    // Check CAPI cluster status
    cy.checkCAPIMenu();
    cy.contains('Machine Deployments').click();
    cy.typeInFilter(clusterName);
    cy.get('.content > .count', {timeout: timeout}).should('have.text', '3');
    cy.checkCAPIClusterActive(clusterName);
  })

  if (skipClusterDeletion) {
    it('Remove imported CAPZ cluster from Rancher Manager and Delete the CAPZ cluster', { retries: 1 }, () => {
      // Delete the imported cluster
      // Ensure that the provisioned CAPI cluster still exists
      // this check can fail, ref: https://github.com/rancher/turtles/issues/1587
      importedRancherClusterDeletion(clusterName);
      // Remove CAPI Resources related to the cluster
      capiClusterDeletion(clusterName, timeout);
    })

    it('Delete the ClusterClass fleet repo and other resources', () => {
      // Remove the clusterclass repo
      cy.removeFleetGitRepo(clusterClassRepoName);
      // Cleanup other resources
      capzResourcesCleanup();
    });
  }

});
