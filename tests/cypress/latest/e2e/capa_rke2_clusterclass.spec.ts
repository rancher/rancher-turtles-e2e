import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipClusterDeletion } from '~/support/utils';

Cypress.config();
describe('Import CAPA RKE2 Class-Cluster', { tags: '@full' }, () => {
  let clusterName: string
  const timeout = 1200000
  const className = 'aws-rke2-example'
  const repoName = 'class-clusters-aws-rke2'
  const branch = 'main'
  const path = '/tests/assets/rancher-turtles-fleet-example/capa/rke2/class-clusters'
  const repoUrl = 'https://github.com/rancher/rancher-turtles-e2e.git'
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/aws/rke2'
  const clusterClassRepoName = 'aws-rke2-clusterclass'
  const providerName = 'aws'
  const accessKey = Cypress.env('aws_access_key')
  const secretKey = Cypress.env('aws_secret_key')

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Disable');
  })

  // TODO: Create Provider via UI, ref: capi-ui-extension/issues/128
  it('Create AWS CAPIProvider & AWSClusterStaticIdentity', () => {
    cy.removeCAPIResource('Providers', providerName);
    cy.createCAPIProvider(providerName);
    cy.checkCAPIProvider(providerName);
    cy.createAWSClusterStaticIdentity(accessKey, secretKey);
  })

  qase(116,
    it('Add CAPA RKE2 ClusterClass Fleet Repo and check Applications', () => {
      cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath, 'capi-classes')
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(className);

      // Navigate to `local` cluster, More Resources > Fleet > Helm Apps and ensure the charts are active.
      cy.burgerMenuOperate('open');
      cy.contains('local').click();
      cy.accesMenuSelection(['More Resources', 'Fleet', 'HelmApps']);
      ['aws-ccm', 'aws-csi-driver'].forEach((app) => {
        cy.typeInFilter(app);
        cy.getBySel('sortable-cell-0-1').should('exist');
      })
    })
  );

  qase(110,
    it('Add CAPA class-clusters fleet repo and get cluster name', () => {
      cypressLib.checkNavIcon('cluster-management')
        .should('exist');

      // Add CAPA fleet repository
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

  qase(111,
    it('Auto import child CAPA cluster', () => {
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

  qase(112,
    it('Install App on imported cluster', () => {
      // Click on imported CAPA cluster
      cy.contains(clusterName).click();

      // Install Chart
      // We install Logging chart instead of Monitoring, since this is relatively lightweight.
      cy.checkChart('Install', 'Logging', 'cattle-logging-system');
    })
  );

  if (skipClusterDeletion) {
    qase(114,
      it('Remove imported CAPA cluster from Rancher Manager', { retries: 1 }, () => {
        // Check cluster is not deleted after removal
        cy.deleteCluster(clusterName);
        cy.goToHome();
        // kubectl get clusters.cluster.x-k8s.io
        // This is checked by ensuring the cluster is not available in navigation menu
        cy.contains(clusterName).should('not.exist');
        cy.checkCAPIClusterProvisioned(clusterName);
      })
    );

    qase(115,
      it('Delete the CAPA cluster and ClusterClass fleet repo', () => {
        // Remove the fleet git repo
        cy.removeFleetGitRepo(repoName);
        // Wait until the following returns no clusters found
        // This is checked by ensuring the cluster is not available in CAPI menu
        cy.checkCAPIClusterDeleted(clusterName, timeout);

        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);

        // Delete secret and AWSClusterStaticIdentity
        cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'cluster-identity', 'capa-system')
        cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'AWSClusterStaticIdentities'], 'cluster-identity')
      })
    );
  }
});
