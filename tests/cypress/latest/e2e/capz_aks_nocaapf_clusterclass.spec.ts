import '../support/commands';
import {getClusterName, skipClusterDeletion, isRancherManagerVersion} from '../support/utils';
import {capiClusterDeletion, capzResourcesCleanup, importedRancherv3ClusterDeletion} from "../support/cleanup_support";
import {vars} from '../support/variables';

Cypress.config();
describe('Import CAPZ AKS (No-Caapf) Class-Cluster', {tags: ['@full', '@nocaapf', '@capzaks-nocaapf']}, () => {
  const timeout = vars.fullTimeout
  const classNamePrefix = 'azure-aks'
  const clusterName = getClusterName(classNamePrefix)
  const classesPath = 'examples/clusterclasses/azure/aks'
  const clusterClassRepoName = "azure-aks-clusterclass"
  const classClusterFileName = './fixtures/azure/capz-aks-class-cluster.yaml'

  const clientSecret = Cypress.expose("azure_client_secret")
  const clientID = Cypress.expose("azure_client_id")
  const subscriptionID = Cypress.expose("azure_subscription_id")
  const tenantID = Cypress.expose("azure_tenant_id")

  before(function () {
    if (isRancherManagerVersion('<2.15')) {
      return cy.task('suiteLog', "NoCAAPF is unsupported on Rancher Version <2.15; skipping...").then(() => {
        this.skip();
      })
    }
  })

  beforeEach(function () {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('[SETUP]', () => {
    qase(323, it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    })
    );

    qase(415, it('Create AzureASOCredential', () => {
      cy.createAzureASOCredential(clientID, tenantID, clientSecret, subscriptionID);
    })
    );

    qase(84, it('Add CAPZ AKS ClusterClass using fleet', () => {
        cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
        // Go to CAPI > ClusterClass to ensure the clusterclass is created
        cy.checkCAPIClusterClass(classNamePrefix);
      })
    );
  })

  context('[CLUSTER-IMPORT]', () => {
    qase(55,
      it('Import CAPZ AKS class-cluster using YAML', () => {
        cy.readFile(classClusterFileName).then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)
          data = data.replace(/replace_k8sVersion/g, vars.aksVersion)
          cy.importYAML(data, vars.capiClustersNS)
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
    qase(57, (isRancherManagerVersion('>2.14') ? it.skip : it)('Install App on imported cluster', {retries: 1}, () => {
      cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
      })
    );

    it('Check for any errors in Turtles logs', () => {
      // Check for any errors
      cy.filterPodErrorLogs('rancher-turtles-controller-manager');
    })
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
      qase(364, it('Remove imported CAPZ cluster from Rancher Manager', {retries: 1}, () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        importedRancherv3ClusterDeletion(clusterName);
      })
      );

      qase(60, it('Delete the CAPZ cluster', () => {
          // Remove CAPI Resources related to the cluster
          capiClusterDeletion(clusterName, timeout);
        })
      );

      qase(325, it('Delete the ClusterClass fleet repo and other resources', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);
        // Cleanup other resources
        capzResourcesCleanup(true);      
      })
      );
    }
  })
});
