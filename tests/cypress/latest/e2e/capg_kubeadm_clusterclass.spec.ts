import '~/support/commands';
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipClusterDeletion } from '~/support/utils';

Cypress.config();
describe('Import CAPG Kubeadm Cluster', { tags: '@full' }, () => {
  let clusterName: string
  const timeout = 1200000
  const className = 'gcp-kubeadm-example'
  const repoName = 'class-clusters-gcp-kb'
  const branch = 'main'
  const path = '/tests/assets/rancher-turtles-fleet-example/capg/kubeadm/class-clusters'
  const repoUrl = 'https://github.com/rancher/rancher-turtles-e2e.git'
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/gcp/kubeadm'
  const clusterClassRepoName = 'gcp-kubeadm-clusterclass'
  const gcpProject = Cypress.env("gcp_project")
  const namespace = 'capg-system'

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  it('Create the helm values secret', () => {
    cy.readFile('./fixtures/capg-helm-values-secret.yaml').then((data) => {
      data = data.replace(/replace_gcp_project/g, gcpProject)
      cy.importYAML(data)
    });
  })

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Disable');
  })

  qase(148,
    it('Add CAPG Kubeadm ClusterClass Fleet Repo and check GCP CCM', () => {
      cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath, 'capi-classes')
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(className);

      // Navigate to `local` cluster, More Resources > Fleet > Helm Apps and ensure the charts are active.
      cy.burgerMenuOperate('open');
      cy.contains('local').click();
      cy.accesMenuSelection(['More Resources', 'Fleet', 'HelmApps']);
      cy.typeInFilter("calico-cni");
      cy.getBySel('sortable-cell-0-1').should('exist');
      cy.accesMenuSelection(['More Resources', 'Fleet', 'Bundle']);
      cy.typeInFilter("cloud-controller-manager-gcp");
      cy.getBySel('sortable-cell-0-1').should('exist');

    })
  );

  qase(143,
    it('Add GitRepo for class-cluster and get cluster name', () => {
      cy.addFleetGitRepo(repoName, repoUrl, branch, path);
      // Check CAPI cluster using its name prefix i.e. className
      cy.checkCAPICluster(className);

      // Get the cluster name by its prefix and use it across the test
      cy.getBySel('sortable-cell-0-1').then(($cell) => {
        clusterName = $cell.text();
        cy.log('CAPI Cluster Name:', clusterName);
      });
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
      cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });
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

  if (skipClusterDeletion) {
    qase(146,
      it('Remove imported CAPG cluster from Rancher Manager', { retries: 1 }, () => {

        // Check cluster is not deleted after removal
        cy.deleteCluster(clusterName);
        cy.goToHome();
        // kubectl get clusters.cluster.x-k8s.io
        // This is checked by ensuring the cluster is not available in navigation menu
        cy.contains(clusterName).should('not.exist');
        cy.checkCAPIClusterProvisioned(clusterName);
      })
    );

    qase(147,
      it('Delete the CAPG cluster fleet repo', () => {

        // Remove the fleet git repo
        cy.removeFleetGitRepo(repoName);
        // Wait until the following returns no clusters found
        // This is checked by ensuring the cluster is not available in CAPI menu
        cy.checkCAPIClusterDeleted(clusterName, timeout);

        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);
      })
    );

    it('Delete the helm values secret', () => {
      cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], "capg-helm-values", namespace)
    });
  }
});
