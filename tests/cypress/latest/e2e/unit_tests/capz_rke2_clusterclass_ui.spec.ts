import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { isRancherManagerVersion, skipClusterDeletion } from '~/support/utils';

Cypress.config();
describe('Import/Create CAPZ RKE2', { tags: '@full' }, () => {
    var clusterName: string;
    const timeout = 1200000
    const namespace = 'capz-system'
    const repoName = 'clusters-capz-rke2'
    const className = 'azure-rke2-example'
    const registrationMethod = "internal-first"
    const k8sVersion = "v1.31.1+rke2r1"
    const branch = 'capz-refactor'
    const path = '/tests/assets/rancher-turtles-fleet-example/capz/rke2/classes'
    const repoUrl = "https://github.com/rancher/rancher-turtles-e2e.git"
    const clientID = Cypress.env("azure_client_id")
    const clientSecret = btoa(Cypress.env("azure_client_secret"))
    const subscriptionID = Cypress.env("azure_subscription_id")
    const tenantID = Cypress.env("azure_tenant_id")
    const location = "westeurope" // the community image for provisioning Azure VM is only available in certain locations
    const clusterClassManifestURL = 'https://raw.githubusercontent.com/rancher/turtles/refs/heads/main/examples/clusterclasses/azure/clusterclass-rke2-example.yaml'

    type App = {
        name: string;
        path: string;
    }
    var supportingHelmApps: App[]
    if (isRancherManagerVersion('2.11')) {
        supportingHelmApps = [{ name: "calico-cni", path: 'https://raw.githubusercontent.com/rancher/turtles/refs/heads/main/examples/applications/cni/calico/helm-chart.yaml' },
        { name: "azure-ccm", path: 'https://raw.githubusercontent.com/rancher/turtles/refs/heads/main/examples/applications/ccm/azure/helm-chart.yaml' }]
    } else {
        supportingHelmApps = [{ name: "calico-cni", path: '/tests/assets/rancher-turtles-fleet-example/cni' },
        { name: "azure-ccm", path: '/tests/assets/rancher-turtles-fleet-example/ccm' }]
    }

    beforeEach(() => {
        cy.login();
        cypressLib.burgerMenuToggle();
    });

    it('Ensure KUBECONFIG is set', () => {
        expect(Cypress.env("kubeconfig")).to.not.be.undefined;
    })

    it('Setup the namespace for importing', () => {
        cy.namespaceAutoImport('Enable');
    })

    it('Create values.yaml Secret', () => {
        cy.createCAPZValuesSecret(location, clientID, tenantID, subscriptionID, k8sVersion, registrationMethod, 3, 3);
    })

    it('Create AzureClusterIdentity', () => {
        cy.createAzureClusterIdentity(clientSecret, clientID, tenantID)
    })

    qase(21, it('Add CAPZ RKE2 ClusterClass', () => {
        cy.exec('kubectl apply -f ' + clusterClassManifestURL).its('code').should('eq', 0);
        // Go to CAPI > ClusterClass to ensure the clusterclass is created
        cy.checkCAPIClusterClass(className);
    })
    );

    it('Add CNI and CCM definitions', () => {
        if (isRancherManagerVersion('2.11')) {
            supportingHelmApps.forEach((app) => {
                cy.exec('kubectl apply -f ' + app.path).its('code').should('eq', 0)
            })

            // Navigate to `local` cluster, More Resources > Fleet > Helm Apps and ensure the charts are active.
            cy.contains('local').click();
            cy.accesMenuSelection(['More Resources', 'Fleet', 'HelmApps']);
            supportingHelmApps.forEach((app) => {
                cy.typeInFilter(app.name);
                cy.getBySel('sortable-cell-0-0').should('contain.text', 'Active');
                cy.getBySel('sortable-cell-0-1').should('exist');
            })
        } else {
            supportingHelmApps.forEach((app) => {
                cy.addFleetGitRepo(app.name, repoUrl, branch, app.path)
            })
        }
    })

    it('Add GitRepo for clusterclass cluster and get cluster name', () => {
        cy.addFleetGitRepo(repoName, repoUrl, branch, path);
        // Check CAPI cluster using its name prefix
        cy.checkCAPICluster(className);

        // Get the cluster name by its prefix and use it across the test
        cy.getBySel('sortable-cell-0-1').then(($cell) => {
            clusterName = $cell.text();
            cy.log('CAPI Cluster Name:', clusterName);
        });
    })

    it('Auto import child CAPZ RKE2 cluster', () => {
        // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
        //  Ensuring cluster is provisioned also ensures all the Cluster Management > Advanced > Machines for the given cluster are Active.
        cy.checkCAPIClusterProvisioned(clusterName, timeout);

        // Check cluster is Active
        cy.searchCluster(clusterName);
        cy.contains(new RegExp('Active.*' + clusterName), { timeout: 300000 });
    })

    qase(23, it('Install App on imported cluster', { retries: 1 }, () => {
        // Click on imported CAPZ cluster
        cy.contains(clusterName).click();

        // Install Chart
        cy.checkChart('Install', 'Monitoring', 'cattle-monitoring');
    })
    );


    if (skipClusterDeletion) {
        qase(25, it('Remove imported CAPZ cluster from Rancher Manager', { retries: 1 }, () => {
            // Check cluster is not deleted after removal
            cy.deleteCluster(clusterName);
            cy.goToHome();
            // kubectl get clusters.cluster.x-k8s.io
            // This is checked by ensuring the cluster is not available in navigation menu
            cy.contains(clusterName).should('not.exist');
            cy.checkCAPIClusterProvisioned(clusterName);
        })
        );

        qase(26, it('Delete the CAPZ cluster fleet repo and remove all the other resources', () => {

            // Remove the fleet git repo
            cy.removeFleetGitRepo(repoName);
            // Wait until the following returns no clusters found
            // This is checked by ensuring the cluster is not available in CAPI menu
            cy.checkCAPIClusterDeleted(clusterName, timeout);

            // Remove the clusterclass; the return code might be 0; might have to check for something else; removing the clusterclass might also suffice; it deletes all the related resources
            // `failOnNonZeroExit` is required because when the CC is deleted, it automatically deletes all the supporting resources and they are not found later when kubectl actually tries to delete them
            cy.exec('kubectl delete -f ' + clusterClassManifestURL, { failOnNonZeroExit: false });

            // Remove the CNI and CCM apps
            if (isRancherManagerVersion('2.11')) {
                supportingHelmApps.forEach((app) => {
                    cy.exec('kubectl delete -f ' + app.path).its('code').should('eq', 0)
                })
            } else {
                supportingHelmApps.forEach((app) => {
                    cy.removeFleetGitRepo(app.name)
                })
            }
            // Delete secret and AzureClusterIdentity
            cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], "azure-creds-secret", namespace)
            cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'AzureClusterIdentities'], 'cluster-identity', 'default')
            cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], "cluster-identity-secret", namespace)
        })
        );
    }

});
