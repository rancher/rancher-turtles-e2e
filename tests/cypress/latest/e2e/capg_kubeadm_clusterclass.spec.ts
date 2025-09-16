import '~/support/commands';

import {qase} from 'cypress-qase-reporter/mocha';
import {getClusterName, skipClusterDeletion} from '~/support/utils';
import {capiClusterDeletion, importedRancherClusterDeletion} from "~/support/cleanup_support";

Cypress.config();
describe('Import CAPG Kubeadm Class-Cluster', { tags: '@full' }, () => {
  const timeout = 1200000
  const classNamePrefix = 'gcp-kubeadm'
  const clusterName = getClusterName(classNamePrefix)
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/gcp/kubeadm'
  const clusterClassRepoName = 'gcp-kubeadm-clusterclass'
  const gcpProject = Cypress.env("gcp_project")

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Disable');
  })

  qase(148,
    it('Add CAPG Kubeadm ClusterClass Fleet Repo and check GCP CCM', () => {
      cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath, 'capi-classes')
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(classNamePrefix);

      // Navigate to `local` cluster, More Resources > Fleet > HelmApps and ensure the charts are present.
      cy.checkFleetHelmApps(['calico-cni']);

      // Check GCP CCM bundle is available
      cy.accesMenuSelection(['More Resources', 'Fleet', 'Bundle']);
      cy.typeInFilter("cloud-controller-manager-gcp");
      cy.getBySel('sortable-cell-0-1').should('exist');
    })
  );

  qase(143,
    it('Import CAPG Kubeadm class-cluster using YAML', () => {
      cy.readFile('./fixtures/gcp/capg-kubeadm-class-cluster.yaml').then((data) => {
        data = data.replace(/replace_cluster_name/g, clusterName)
        data = data.replace(/replace_gcp_project/g, gcpProject)
        cy.importYAML(data,'capi-clusters')
      });
      // Check CAPI cluster using its name
      cy.checkCAPICluster(clusterName);
    })
  );

  qase(144,
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
      cy.checkCAPIClusterActive(clusterName, timeout);
    })
  );

  qase(145,
    it('Install App on imported cluster', () => {
      // Click on imported CAPG cluster
      cy.contains(clusterName).click();

      // Install Chart
      // We install Logging chart instead of Monitoring, since this is relatively lightweight.
      cy.checkChart('Install', 'Logging', 'cattle-logging-system');
    })
  );

  it("Scale up imported CAPG cluster by patching class-cluster yaml", () => {
    cy.readFile('./fixtures/gcp/capg-kubeadm-class-cluster.yaml').then((data) => {
      data = data.replace(/replicas: 2/g, 'replicas: 3')

      // workaround; these values need to be re-replaced before applying the scaling changes
      data = data.replace(/replace_cluster_name/g, clusterName)
      data = data.replace(/replace_gcp_project/g, gcpProject)
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
    qase(146,
      it('Remove imported CAPG cluster from Rancher Manager and Delete the CAPG cluster', { retries: 1 }, () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        // this check can fail, ref: https://github.com/rancher/turtles/issues/1587
        importedRancherClusterDeletion(clusterName);
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
});
