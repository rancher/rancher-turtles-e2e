import '~/support/commands';

import {getClusterName, skipClusterDeletion} from '~/support/utils';
import {capiClusterDeletion, importedRancherClusterDeletion} from "~/support/cleanup_support";
import {vars} from '~/support/variables';

Cypress.config();
describe('Import CAPG GKE Class-Cluster', {tags: '@full'}, () => {   // This test will only work in CAPG 1.11, i.e. Rancher >= 2.14, Turtles >= 0.26
  const timeout = vars.fullTimeout * 2
  const classNamePrefix = 'gcp-gke'
  const clusterName = getClusterName(classNamePrefix)
  const classesPath = 'examples/clusterclasses/gcp/gke'
  const clusterClassRepoName = 'gcp-gke-example'
  const classClusterFileName = './fixtures/gcp/capg-gke-class-cluster.yaml'

  const gcpProject = Cypress.expose('gcp_project')
  const k8sVersion = 'v1.35.0'      // this version is different from GCP Kubeadm version

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('[SETUP]', () => {
    it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    })


      it('Add CAPG GKE ClusterClass Fleet Repo and check GCP CCM', () => {
        cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
        // Go to CAPI > ClusterClass to ensure the clusterclass is created
        cy.checkCAPIClusterClass(classNamePrefix);
      });
  })

  context('[CLUSTER-IMPORT]', () => {
      it('Import CAPG GKE class-cluster using YAML', () => {
        cy.readFile(classClusterFileName).then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)
          data = data.replace(/replace_k8sVersion/g, k8sVersion)
          data = data.replace(/replace_gcp_project/g, gcpProject)
          cy.importYAML(data, vars.capiClustersNS)
        });
        // Check CAPI cluster using its name
        cy.checkCAPICluster(clusterName);
      });

      it('Auto import child CAPG cluster', () => {
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
        cy.checkCAPIClusterActive(clusterName, timeout, true);
      });
  })

  context('[CLUSTER-OPERATIONS]', () => {
    it('Install App on imported cluster', {retries: 1}, () => {
      // Install Chart
      // We install Logging chart instead of Monitoring, since this is relatively lightweight.
      cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
    });

    it('Remove imported CAPG cluster from Rancher Manager', {retries: 1}, () => {
      // Delete the imported cluster
      // Ensure that the provisioned CAPI cluster still exists
      // this check can fail, ref: https://github.com/rancher/turtles/issues/1587
      importedRancherClusterDeletion(clusterName);
    })
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
      it('Delete the CAPG cluster', {retries: 1}, () => {
        // Remove CAPI Resources related to the cluster
        capiClusterDeletion(clusterName, timeout);
      });

      it('Delete the ClusterClass fleet repo', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);
      });
    }
  })
});
