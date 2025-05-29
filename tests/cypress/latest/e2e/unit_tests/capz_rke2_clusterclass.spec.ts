import '~/support/commands';
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipClusterDeletion } from '~/support/utils';

Cypress.config();
describe('Import CAPZ RKE2 Class-Cluster', { tags: '@full' }, () => {
    var clusterName: string;
    const timeout = 1200000
    const namespace = 'capz-system'
    const repoName = 'class-clusters-azure-rke2'
    const className = 'azure-rke2-example'
    const branch = 'main'
    const path = '/tests/assets/rancher-turtles-fleet-example/capz/rke2/class-clusters'
    const repoUrl = "https://github.com/rancher/rancher-turtles-e2e.git"
    const turtlesRepoUrl = 'https://github.com/rancher/turtles'
    const examplesPath = ['examples/clusterclasses/azure/rke2', '/examples/applications/ccm/azure']
    const clusterClassRepoName = "azure-rke2-clusterclass"

    const clientID = Cypress.env("azure_client_id")
    const clientSecret = btoa(Cypress.env("azure_client_secret"))
    const subscriptionID = Cypress.env("azure_subscription_id")
    const tenantID = Cypress.env("azure_tenant_id")

    beforeEach(() => {
        cy.login();
        cy.burgerMenuOperate('open')
    });

    it('Setup the namespace for importing', () => {
        cy.namespaceAutoImport('Enable');
    })

    it('Create values.yaml Secret', () => {
        cy.createCAPZValuesSecret(clientID, tenantID, subscriptionID);
    })

    it('Create AzureClusterIdentity', () => {
        cy.createAzureClusterIdentity(clientID, tenantID, clientSecret)
    })

    qase(87, it('Add CAPZ RKE2 ClusterClass and Azure CCM Fleet Repo', () => {
        cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', examplesPath)
        // Go to CAPI > ClusterClass to ensure the clusterclass is created
        cy.checkCAPIClusterClass(className);

        // Navigate to `local` cluster, More Resources > Fleet > Helm Apps and ensure the charts are active.
        cy.burgerMenuOperate('open');
        cy.contains('local').click();
        cy.accesMenuSelection(['More Resources', 'Fleet', 'HelmApps']);
        ["azure-ccm", "calico-cni"].forEach((app) => {
            cy.typeInFilter(app);
            cy.waitForAllRowsInState('Active');
        })
    })
    );

    qase(78, it('Add GitRepo for class-cluster and get cluster name', () => {
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

    qase(79, it('Auto import child CAPZ RKE2 cluster', () => {
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

    qase(80, it('Install App on imported cluster', () => {
        // Click on imported CAPZ cluster
        cy.contains(clusterName).click();

        // Install Chart
        // We install Logging chart instead of Monitoring, since this is relatively lightweight.
        cy.checkChart('Install', 'Logging', 'cattle-logging-system');
    })
    );


    if (skipClusterDeletion) {
        qase(82, it('Remove imported CAPZ cluster from Rancher Manager', { retries: 1 }, () => {
            // Check cluster is not deleted after removal
            cy.deleteCluster(clusterName);
            cy.goToHome();
            // kubectl get clusters.cluster.x-k8s.io
            // This is checked by ensuring the cluster is not available in navigation menu
            cy.contains(clusterName).should('not.exist');
            cy.checkCAPIClusterProvisioned(clusterName);
        })
        );

        qase(83, it('Delete the CAPZ cluster and clusterclasses fleet repo and other resources', () => {

            // Remove the fleet git repo
            cy.removeFleetGitRepo(repoName);
            // Wait until the following returns no clusters found
            // This is checked by ensuring the cluster is not available in CAPI menu
            cy.checkCAPIClusterDeleted(clusterName, timeout);

            // Remove the clusterclass repo
            cy.removeFleetGitRepo(clusterClassRepoName);

            // Delete secret and AzureClusterIdentity
            cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], "azure-creds-secret", namespace)
            cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'AzureClusterIdentities'], 'cluster-identity', 'default')
            cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], "cluster-identity-secret", namespace)
        })
        );
    }

});
