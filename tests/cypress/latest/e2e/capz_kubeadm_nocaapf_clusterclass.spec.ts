import '../support/commands';
import {getClusterName, isUseCAAPFSupported, skipClusterDeletion, isRancherManagerVersion, getCAPIClusterKubeconfig, applyYAMLManifest} from '../support/utils';
import {capiClusterDeletion, capzResourcesCleanup, importedRancherv3ClusterDeletion} from "../support/cleanup_support";
import {vars} from '../support/variables';

Cypress.config();
describe('Import CAPZ Kubeadm (No-Caapf) Class-Cluster', {tags: ['@full', '@nocaapf', '@capzk-nocaapf']}, () => {
  const timeout = vars.fullTimeout
  const classNamePrefix = 'azure-kubeadm'
  const clusterName = getClusterName(classNamePrefix)
  const classesPath = 'examples/clusterclasses/azure/kubeadm'
  const clusterClassRepoName = "azure-kubeadm-clusterclass"
  const classClusterFileName = './fixtures/azure/capz-kubeadm-class-cluster-nocaapf.yaml'

  const clientID = Cypress.expose("azure_client_id")
  const clientSecret = btoa(Cypress.expose("azure_client_secret"))
  const subscriptionID = Cypress.expose("azure_subscription_id")
  const tenantID = Cypress.expose("azure_tenant_id")

  const azureCCMFileName = "cloud-provider-azure.yaml"
  const azureCCMCmd = [`wget ${vars.azureCCMYaml}`, `sed -i 's|\${CLUSTER_CIDR}|192.168.0.0/16|g' ${azureCCMFileName}`, applyYAMLManifest(clusterName, azureCCMFileName)]

  // Azure CCM fails to install when using v1.35
  const k8sVersion = isRancherManagerVersion('2.14') ? 'v1.34.1'
    : vars.kubeadmVersion

  beforeEach(function () {
    if (!isUseCAAPFSupported) {
      // This test is only meant for >=2.14.1
      this.skip();
    }
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('[SETUP]', () => {
    qase(329, it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    })
    );

    qase(346, it('Create AzureClusterIdentity', () => {
      cy.createAzureClusterIdentity(clientID, tenantID, clientSecret)
    })
    );

    qase(330, it('Add CAPZ Kubeadm ClusterClass Fleet Repo', () => {
      cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(classNamePrefix);
      })
    );
  })

  context('[CLUSTER-IMPORT]', () => {
    qase(331, it('Import CAPZ Kubeadm class-cluster using YAML', () => {
      cy.readFile(classClusterFileName).then((data) => {
        data = data.replace(/replace_cluster_name/g, clusterName)
        data = data.replace(/replace_k8sVersion/g, k8sVersion)
        data = data.replace(/replace_subscription_id/g, subscriptionID)
        cy.importYAML(data, vars.capiClustersNS)
      });
      // Check CAPI cluster using its name
      cy.checkCAPICluster(clusterName);

      // Check CAPI cluster status
      cy.checkCAPIClusterCPInitialized(clusterName);
    })
    );

    it('Apply the CNI & CCM manifest', () => {
      cy.kubectlExecute([getCAPIClusterKubeconfig(clusterName), applyYAMLManifest(clusterName, vars.calicoCNIYaml), azureCCMCmd[0], azureCCMCmd[1], azureCCMCmd[2]], 15000);
    })

    qase(332, it('Auto import child CAPZ Kubeadm cluster', () => {
      // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
      cy.checkCAPIClusterProvisioned(clusterName, timeout);

      // Check child cluster is created and auto-imported
      // This is checked by ensuring the cluster is available in navigation menu
      cy.goToHome();
      cy.contains(clusterName, {timeout: timeout}).should('exist');

      // Check cluster is Active
      cy.searchCluster(clusterName);
      cy.contains(new RegExp('Active.*' + clusterName), {timeout: timeout});

      // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
      // Ensuring cluster is provisioned also ensures all the Cluster Management > Advanced > Machines for the given cluster are Active.
      cy.checkCAPIClusterActive(clusterName, timeout);
    })
    );
  })

  context('[CLUSTER-OPERATIONS]', () => {
    qase(333, (isRancherManagerVersion('>2.14') ? it.skip : it)('Install App on imported cluster', {retries: 1}, () => {
      cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
    })
    );

    qase(334, it("Scale up imported CAPZ cluster by patching class-cluster yaml", () => {
      cy.readFile(classClusterFileName).then((data) => {
        data = data.replace(/replicas: 2/g, 'replicas: 3')

        // workaround; these values need to be re-replaced before applying the scaling changes
        data = data.replace(/replace_cluster_name/g, clusterName)
        data = data.replace(/replace_k8sVersion/g, k8sVersion)
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
    );

    it('Check for any errors in Turtles logs', () => {
      // Check for any errors
      cy.filterPodErrorLogs('rancher-turtles-controller-manager');
    })
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
      qase(366, it('Remove imported CAPZ cluster from Rancher Manager', () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        importedRancherv3ClusterDeletion(clusterName);
      })
      );

      qase(336, it('Delete the CAPZ cluster', {retries: 1}, () => {
        // Remove CAPI Resources related to the cluster
        capiClusterDeletion(clusterName, timeout);
      })
      );

      qase(337, it('Delete the ClusterClass fleet repo and other resources', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);
        // Cleanup other resources
        capzResourcesCleanup();
      })
      );
    }
  })
});
