import '../support/commands';
import {getClusterName, isRancherManagerVersion, skipClusterDeletion, getCAPIClusterKubeconfig, applyYAMLManifest} from '../support/utils';
import {capaResourcesCleanup, capiClusterDeletion, importedRancherv3ClusterDeletion} from "../support/cleanup_support";
import {vars} from '../support/variables';

Cypress.config();
describe('Import CAPA Kubeadm (No-Caapf) Class-Cluster', {tags: ['@full', '@full-nocaapf', '@nocaapf', '@capak-nocaapf']}, () => {
  const timeout = vars.fullTimeout
  const classNamePrefix = 'aws-kubeadm'
  const clusterName = getClusterName(classNamePrefix)
  const classesPath = 'examples/clusterclasses/aws/kubeadm'
  const clusterClassRepoName = 'aws-kb-clusterclass'
  const classClusterFileName = './fixtures/aws/capa-kubeadm-class-cluster-nocaapf.yaml'

  const accessKey = Cypress.expose('aws_access_key')
  const secretKey = Cypress.expose('aws_secret_key')

  before(function () {
    if (isRancherManagerVersion('<2.15')) {
      return cy.task('suiteLog', "NoCAAPF is unsupported on Rancher Version <2.15; skipping...").then(() => {
        this.skip();
      })
    }
  })

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('[SETUP]', () => {
    it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    });

    it('Create AWSClusterStaticIdentity', () => {
      cy.createAWSClusterStaticIdentity(accessKey, secretKey);
    });

    it('Add CAPA Kubeadm ClusterClass Fleet Repo', () => {
      cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.noCaapfClassBranch, classesPath, vars.capiClassesNS)
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(classNamePrefix);
    });
  })

  context('[CLUSTER-IMPORT]', () => {
    it('Import CAPA Kubeadm class-cluster using YAML', () => {
      cy.readFile(classClusterFileName).then((data) => {
        data = data.replace(/replace_cluster_name/g, clusterName)
        data = data.replace(/replace_k8sVersion/g, vars.kubeadmVersion)
        data = data.replace(/replace_amiID/g, vars.amiID)
        cy.importYAML(data, vars.capiClustersNS)
      });
      // Check CAPI cluster using its name
      cy.checkCAPICluster(clusterName);

      // Check CAPI cluster status
      cy.checkCAPIClusterCPInitialized(clusterName);
    });

    it('Apply the CNI, CCM & CSI manifest', () => {
      cy.kubectlExecute([getCAPIClusterKubeconfig(clusterName), applyYAMLManifest(clusterName, vars.calicoCNIYaml), applyYAMLManifest(clusterName, vars.awsCCMYaml), applyYAMLManifest(clusterName, vars.awsCSIYaml)]);
    });

    it('Auto import child CAPA cluster', () => {
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
    it.skip('Install App on imported cluster', {retries: 1}, () => {
      cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
    });

    it("Scale up imported CAPA cluster by patching class-cluster yaml", () => {
      cy.readFile(classClusterFileName).then((data) => {
        data = data.replace(/replicas: 2/g, 'replicas: 3')

        // workaround; these values need to be re-replaced before applying the scaling changes
        data = data.replace(/replace_cluster_name/g, clusterName)
        data = data.replace(/replace_k8sVersion/g, vars.kubeadmVersion)
        data = data.replace(/replace_amiID/g, vars.amiID)
        cy.importYAML(data, vars.capiClustersNS)
      })

      // Check CAPI cluster status
      cy.checkCAPIMenu();
      cy.contains('Machine Deployments').click();
      cy.typeInFilter(clusterName);
      cy.get('.content > .count', {timeout: timeout}).should('have.text', '3');
      cy.checkCAPIClusterActive(clusterName);
    });

    it('Check for any errors in Turtles logs', () => {
      // Check for any errors
      cy.filterPodErrorLogs('rancher-turtles-controller-manager');
    });
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
      it('Remove imported CAPA cluster from Rancher Manager', () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        importedRancherv3ClusterDeletion(clusterName);
      });

      it('Delete the CAPA cluster', {retries: 1}, () => {
        // Remove CAPI Resources related to the cluster
        capiClusterDeletion(clusterName, timeout);
      });

      it('Delete the ClusterClass fleet repo and other resources', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);
        // Cleanup other resources
        capaResourcesCleanup();
      });
    }
  })
});
