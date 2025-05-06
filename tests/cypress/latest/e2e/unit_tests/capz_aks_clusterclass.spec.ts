import '~/support/commands';

import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import * as randomstring from "randomstring";
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipClusterDeletion } from '~/support/utils';
import { ClusterClassVariablesInput } from '~/support/structs';

Cypress.config();
describe('Import/Create CAPZ AKS with ClusterClass', { tags: '@full' }, () => {
  const timeout = 1200000
  const repoName = 'class-clusters-capz-aks'
  const className = 'azure-aks-example'
  const clusterName = className + randomstring.generate({ length: 4, capitalization: "lowercase" })
  const k8sVersion = 'v1.31.4'
  const podCIDR = '192.168.0.0/16'
  const branch = 'main'
  const path = '/tests/assets/rancher-turtles-fleet-example/capz/aks/class-clusters'
  const repoUrl = "https://github.com/rancher/rancher-turtles-e2e.git"
  const clientID = Cypress.env("azure_client_id")
  const clientSecret = btoa(Cypress.env("azure_client_secret"))
  const subscriptionID = Cypress.env("azure_subscription_id")
  const tenantID = Cypress.env("azure_tenant_id")
  const location = "westeurope" // this is one of the regions supported by ClusterClass definition
  const namespace = "capz-system"
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = '/examples/clusterclasses/azure'
  const clusterClassRepoName = "azure-clusterclasses"

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open')
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Enable');
  })

  it('Create values.yaml Secret', () => {
    cy.createCAPZValuesSecret(location, clientID, tenantID, subscriptionID, k8sVersion, undefined, 1, 1)
  })

  it('Create AzureClusterIdentity', () => {
    cy.createAzureClusterIdentity(clientSecret, clientID, tenantID)
  })

  qase(21, it('Add CAPZ AKS ClusterClass using fleet', () => {
    cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath)
    // Go to CAPI > ClusterClass to ensure the clusterclass is created
    cy.checkCAPIClusterClass(className);
  })
  );

  var fleetClusterName: string;
  it('Add GitRepo for cluster and get cluster name', () => {
    cy.addFleetGitRepo(repoName, repoUrl, branch, path);
    // Check CAPI cluster using its name prefix i.e. className
    cy.checkCAPICluster(className);

    // Get the cluster name by its prefix and use it across the test
    cy.getBySel('sortable-cell-0-1').then(($cell) => {
      fleetClusterName = $cell.text();
      cy.log('CAPI Cluster Name:', fleetClusterName);
    });
  })

  it('Auto import child CAPZ AKS cluster', () => {
    // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
    cy.checkCAPIClusterProvisioned(fleetClusterName, timeout);

    // Check child cluster is created and auto-imported
    // This is checked by ensuring the cluster is available in navigation menu
    cy.goToHome();
    cy.contains(fleetClusterName).should('exist');

    // Check cluster is Active
    cy.searchCluster(fleetClusterName);
    cy.contains(new RegExp('Active.*' + fleetClusterName), { timeout: timeout });
  })

  if (skipClusterDeletion) {
    it('Delete the imported cluster and remove the fleet repo', () => {
      // Check cluster is not deleted after removal
      cy.deleteCluster(fleetClusterName);
      cy.goToHome();
      // kubectl get clusters.cluster.x-k8s.io
      // This is checked by ensuring the cluster is not available in navigation menu
      cy.contains(fleetClusterName).should('not.exist');
      cy.checkCAPIClusterProvisioned(fleetClusterName);

      // Remove the fleet git repo
      cy.removeFleetGitRepo(repoName);
      // Wait until the following returns no clusters found
      // This is checked by ensuring the cluster is not available in CAPI menu
      cy.checkCAPIClusterDeleted(fleetClusterName, timeout);

    })
  }


  qase(45, it('Create CAPZ from Clusterclass via UI', () => {
    // Create cluster from Clusterclass UI
    const machines: Record<string, string> = { 'mp-system': 'default-system', 'mp-worker': 'default-worker' }
    const extraVariables: ClusterClassVariablesInput[] = [
      { name: 'subscriptionID', value: subscriptionID, type: 'string' },
      { name: 'location', value: location, type: 'dropdown' },
      { name: 'resourceGroup', value: clusterName, type: 'string' }

    ]
    cy.createCAPICluster(className, clusterName, machines, k8sVersion, podCIDR, undefined, extraVariables);
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
    cy.checkChart('Install', 'Logging', 'cattle-logging-system');
  })
  );

  if (skipClusterDeletion) {
    qase(25, it('Remove created CAPZ cluster from Rancher Manager and Delete the CAPZ cluster', { retries: 1 }, () => {
      // Check cluster is not deleted after removal
      cy.deleteCluster(clusterName);
      cy.goToHome();
      // kubectl get clusters.cluster.x-k8s.io
      // This is checked by ensuring the cluster is not available in navigation menu
      cy.contains(clusterName).should('not.exist');
      cy.checkCAPIClusterProvisioned(clusterName);

      // Delete CAPI cluster created via UI
      cy.removeCAPIResource('Clusters', clusterName, timeout);
    })
    );

    qase(26, it('Delete the CAPZ clusterclasses fleet repo and other resources', () => {
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
