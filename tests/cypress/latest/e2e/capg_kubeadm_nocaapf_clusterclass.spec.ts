import '../support/commands';
import {
  getClusterName,
  skipClusterDeletion,
  isRancherManagerVersion,
  getCAPIClusterKubeconfig,
  applyYAMLManifest
} from '../support/utils';
import {capiClusterDeletion, importedRancherv3ClusterDeletion} from "../support/cleanup_support";
import {vars} from '../support/variables';

Cypress.config();
describe('Import CAPG Kubeadm (No-Caapf) Class-Cluster', {tags: ['@full', '@full-nocaapf', '@nocaapf', '@capgk-nocaapf']}, () => {
  const timeout = vars.fullTimeout
  const classNamePrefix = 'gcp-kubeadm'
  const clusterName = getClusterName(classNamePrefix)
  const classesPath = 'examples/clusterclasses/gcp/kubeadm'
  const clusterClassRepoName = 'gcp-kubeadm-clusterclass'
  const classClusterFileName = './fixtures/gcp/capg-kubeadm-class-cluster-nocaapf.yaml'

  const googleProvider = 'gcp'
  const gcpProject = Cypress.expose("gcp_project")
  const k8sVersion = isRancherManagerVersion('2.14') ? 'v1.34.1'
  : vars.kubeadmVersion

  const gcpCCMFileName = "cloud-provider-gcp.yaml"
  const gcpCCMCmd = [`wget ${vars.gcpCCMYaml}`, `sed -i 's|\${CLUSTER_CIDR}|192.168.0.0/16|g' ${gcpCCMFileName}`, applyYAMLManifest(clusterName, gcpCCMFileName)]

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
    qase(320, it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    })
    );

    qase(148,
      it('Add CAPG Kubeadm ClusterClass Fleet Repo and check GCP CCM', () => {
        cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
        // Go to CAPI > ClusterClass to ensure the clusterclass is created
        cy.checkCAPIClusterClass(classNamePrefix);
      })
    );
  })

  context('[CLUSTER-IMPORT]', () => {
    qase(143,
      it('Import CAPG Kubeadm class-cluster using YAML', () => {
        cy.readFile(classClusterFileName).then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)
          data = data.replace(/replace_k8sVersion/g, k8sVersion)
          data = data.replace(/replace_gcpImageId/g, vars.gcpImageId)
          data = data.replace(/replace_gcp_project/g, gcpProject)
          cy.importYAML(data, vars.capiClustersNS)
        });
        // Check CAPI cluster using its name
        cy.checkCAPICluster(clusterName);

        // Check CAPI cluster status
        cy.checkCAPIClusterCPInitialized(clusterName);
      })
    );

    it('Apply the CNI & CCM manifest', () => {
      cy.kubectlExecute([getCAPIClusterKubeconfig(clusterName), applyYAMLManifest(clusterName, vars.calicoCNIYaml), gcpCCMCmd[0], gcpCCMCmd[1], gcpCCMCmd[2]]);
    })

    qase(144,
      it('Auto import child CAPG cluster', () => {
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
    qase(145,
      (isRancherManagerVersion('>2.14') ? it.skip : it)('Install App on imported cluster', {retries: 1}, () => {
        cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
      })
    );

    qase(321, it("Scale up imported CAPG cluster by patching class-cluster yaml", () => {
      cy.readFile(classClusterFileName).then((data) => {
        data = data.replace(/replicas: 2/g, 'replicas: 3')

        // workaround; these values need to be re-replaced before applying the scaling changes
        data = data.replace(/replace_cluster_name/g, clusterName)
        data = data.replace(/replace_k8sVersion/g, k8sVersion)
        data = data.replace(/replace_gcpImageId/g, vars.gcpImageId)
        data = data.replace(/replace_gcp_project/g, gcpProject)
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
      qase(363, it('Remove imported CAPG cluster from Rancher Manager', () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        importedRancherv3ClusterDeletion(clusterName);
      })
      );

      qase(146,
        it('Delete the CAPG cluster', {retries: 1}, () => {
          // Remove CAPI Resources related to the cluster
          capiClusterDeletion(clusterName, timeout);
        })
      );

      qase(147,
        it('Delete the ClusterClass fleet repo', () => {
          // Remove the clusterclass repo
          cy.removeFleetGitRepo(clusterClassRepoName);
        })
      );
    }
  })
});
