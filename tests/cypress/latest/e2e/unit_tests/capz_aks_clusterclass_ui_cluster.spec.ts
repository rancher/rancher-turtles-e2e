import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import * as randomstring from "randomstring";
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipClusterDeletion } from '~/support/utils';

Cypress.config();
describe('Import/Create CAPZ', { tags: '@full' }, () => {
  var clusterName: string;
  const timeout = 1200000
  const repoName = 'clusters-capz-aks'
  const className = 'azure-aks-example'
  // Managedcluster failed to create or update. err: reconcile error that cannot be recovered occurred: resource is not Ready: The length of the node resource group name is too long. The maximum length is 80 and the length of the value provided is 87. Please see https://aka.ms/aks-naming-rules for more details.: PUT https://management.azure.com/subscriptions/80de5134-ca65-4731-be21-13fb1f0910a2/resourceGroups/azure-aks-example-qa-cluster-y9ke/providers/Microsoft.ContainerService/managedClusters/azure-aks-example-qa-cluster-y9ke-r46cw -------------------------------------------------------------------------------- RESPONSE 400: 400 Bad Request ERROR CODE: InvalidParameter -------------------------------------------------------------------------------- { "code": "InvalidParameter", "details": null, "message": "The length of the node resource group name is too long. The maximum length is 80 and the length of the value provided is 87. Please see https://aka.ms/aks-naming-rules for more details.", "subcode": "", "target": "name" } -------------------------------------------------------------------------------- . Object will not be requeued

  const clusterNamePrefix = className
  // const clusterName = clusterNamePrefix + randomstring.generate({ length: 4, capitalization: "lowercase" })
  const machineName = 'default-system'
  const k8sVersion = 'v1.31.1'
  const podCIDR = '192.168.0.0/16'
  const branch = 'capz-refactor'
  const path = '/tests/assets/rancher-turtles-fleet-example/capz/aks/classes'
  const repoUrl = "https://github.com/rancher/rancher-turtles-e2e.git"
  const clientID = Cypress.env("azure_client_id")
  const clientSecret = btoa(Cypress.env("azure_client_secret"))
  const subscriptionID = Cypress.env("azure_subscription_id")
  const tenantID = Cypress.env("azure_tenant_id")
  const location = "westeurope" // this is one of the regions supported by ClusterClass definition
  const namespace = "capz-system"
  const clusterClassManifestURL = 'https://raw.githubusercontent.com/rancher/turtles/refs/heads/main/examples/clusterclasses/azure/clusterclass-aks-example.yaml'

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
    cy.createCAPZValuesSecret(location, clientID, tenantID, subscriptionID, k8sVersion, undefined, 1, 1)
  })

  it('Create AzureClusterIdentity', () => {
    cy.createAzureClusterIdentity(clientSecret, clientID, tenantID)
  })

  qase(21, it('Add CAPZ AKS ClusterClass', () => {
    cy.exec('kubectl apply -f ' + clusterClassManifestURL).its('code').should('eq', 0);
    // Go to CAPI > ClusterClass to ensure the clusterclass is created
    cy.checkCAPIClusterClass(className);
  })
  );

  it('Add GitRepo for clusterclass cluster and get cluster name', () => {
    cy.addFleetGitRepo(repoName, repoUrl, branch, path);
    // Check CAPI cluster using its name prefix
    cy.checkCAPICluster(clusterNamePrefix);

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


  qase(44, xit('Create CAPZ from Clusterclass via UI', () => {
    // Create cluster from Clusterclass UI
    cy.createCAPICluster(className, clusterName, machineName, k8sVersion, podCIDR);
    cy.checkCAPIMenu();
    cy.contains(new RegExp('Provisioned.*' + clusterName), { timeout: timeout });

    // Check child cluster is auto-imported
    cy.searchCluster(clusterName);
    cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });
  })
  );

  qase(23, it('Install App on imported cluster', { retries: 1 }, () => {
    // Click on imported CAPZ cluster
    cy.contains(clusterName).click();

    // Install Chart
    cy.checkChart('Install', 'Monitoring', 'cattle-monitoring');
  })
  );


  if (skipClusterDeletion) {
    qase(25, it('Remove imported CAPZ cluster from Rancher Manager and Delete the CAPZ cluster', { retries: 1 }, () => {
      // Check cluster is not deleted after removal
      cy.deleteCluster(clusterName);
      cy.goToHome();
      // kubectl get clusters.cluster.x-k8s.io
      // This is checked by ensuring the cluster is not available in navigation menu
      cy.contains(clusterName).should('not.exist');
      cy.checkCAPIClusterProvisioned(clusterName);

    })
    );

    qase(26, it('Delete the CAPZ cluster fleet repo', () => {

      // Remove the fleet git repo
      cy.removeFleetGitRepo(repoName);
      // Wait until the following returns no clusters found
      // This is checked by ensuring the cluster is not available in CAPI menu
      cy.checkCAPIClusterDeleted(clusterName, timeout);

      // Remove the clusterclass; the return code might be 0; might have to check for something else; removing the clusterclass might also suffice; it deletes all the related resources
      // `failOnNonZeroExit` is required because when the CC is deleted, it automatically deletes all the supporting resources and they are not found later when kubectl actually tries to delete them
      cy.exec('kubectl delete -f ' + clusterClassManifestURL, { failOnNonZeroExit: false });

      // Delete secret and AzureClusterIdentity
      cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], "azure-creds-secret", namespace)
      cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'AzureClusterIdentities'], 'cluster-identity', 'default')
      cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], "cluster-identity-secret", namespace)
    })
    );
  }

});
