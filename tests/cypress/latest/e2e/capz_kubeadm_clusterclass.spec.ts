import '~/support/commands';
import {getClusterName, isAPIv1beta1, skipClusterDeletion} from '~/support/utils';
import {capiClusterDeletion, capzResourcesCleanup, importedRancherClusterDeletion} from "~/support/cleanup_support";
import {vars} from '~/support/variables';

Cypress.config();
describe('Import CAPZ Kubeadm Class-Cluster', {tags: '@full'}, () => {
  const timeout = vars.fullTimeout
  const classNamePrefix = 'azure-kubeadm'
  const clusterName = getClusterName(classNamePrefix)
  const classesPath = 'examples/clusterclasses/azure/kubeadm'
  const clusterClassRepoName = "azure-kubeadm-clusterclass"
  const classClusterFileName = isAPIv1beta1 ? './fixtures/azure/capz-kubeadm-class-cluster-v1beta1.yaml' : './fixtures/azure/capz-kubeadm-class-cluster.yaml'

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
      cy.createAzureClusterIdentity(clientID, tenantID, clientSecret)
    })

    it('Add CAPZ Kubeadm ClusterClass Fleet Repo and check Azure CCM', () => {
      cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(classNamePrefix);

      // Navigate to `local` cluster, More Resources > Fleet > HelmOps and ensure the charts are present.
      cy.checkFleetHelmOps(['azure-ccm', 'calico-cni']);
    });
  })

  context('[CLUSTER-IMPORT]', () => {
    it('Import CAPZ Kubeadm class-cluster using YAML', () => {
      cy.readFile(classClusterFileName).then((data) => {
        data = data.replace(/replace_cluster_name/g, clusterName)
        data = data.replace(/replace_k8sVersion/g, vars.k8sVersion)
        data = data.replace(/replace_subscription_id/g, subscriptionID)
        cy.importYAML(data, vars.capiClustersNS)
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
      cy.contains(new RegExp('Active.*' + clusterName), {timeout: timeout});

      // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
      // Ensuring cluster is provisioned also ensures all the Cluster Management > Advanced > Machines for the given cluster are Active.
      cy.checkCAPIClusterActive(clusterName, timeout);
    });
  })

  context('[CLUSTER-OPERATIONS]', () => {
    it('Install App on imported cluster', {retries: 1}, () => {
      // Install Chart
      // We install Logging chart instead of Monitoring, since this is relatively lightweight.
      cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
    });

    it("Scale up imported CAPZ cluster by patching class-cluster yaml", () => {
      cy.readFile(classClusterFileName).then((data) => {
        data = data.replace(/replicas: 2/g, 'replicas: 3')

        // workaround; these values need to be re-replaced before applying the scaling changes
        data = data.replace(/replace_cluster_name/g, clusterName)
        data = data.replace(/replace_k8sVersion/g, vars.k8sVersion)
        data = data.replace(/replace_subscription_id/g, subscriptionID)
        cy.importYAML(data, vars.capiClustersNS)
      })

      // Check CAPI cluster status
      cy.checkCAPIMenu();
      cy.contains('Machine Deployments').click();
      cy.typeInFilter(clusterName);
      cy.get('.content > .count', {timeout: timeout}).should('have.text', '3');
      cy.checkCAPIClusterActive(clusterName);
    })

    it('Remove imported CAPZ cluster from Rancher Manager', {retries: 1}, () => {
      // Delete the imported cluster
      // Ensure that the provisioned CAPI cluster still exists
      // this check can fail, ref: https://github.com/rancher/turtles/issues/1587
      importedRancherClusterDeletion(clusterName);
    })
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
      it('Delete the CAPZ cluster', {retries: 1}, () => {
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
  })
});
