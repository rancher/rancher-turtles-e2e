import '~/support/commands';

import * as randomstring from "randomstring";
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipClusterDeletion } from '~/support/utils';
import { ClusterClassVariablesInput } from '~/support/structs';

Cypress.config();
describe('Import/Create CAPZ AKS Class-Cluster', { tags: '@full' }, () => {
  const separator = '-'
  const timeout = 1200000
  const classNamePrefix = 'azure-aks'
  const clusterName = 'turtles-qa'.concat(separator, classNamePrefix, separator, randomstring.generate({ length: 4, capitalization: 'lowercase' }), separator, Cypress.env('cluster_user_suffix'))
  const k8sVersion = 'v1.31.4'
  const podCIDR = '192.168.0.0/16'
  const location = "westeurope" // this is one of the regions supported by ClusterClass definition
  const namespace = "capz-system"
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/azure/aks'
  const clusterClassRepoName = "azure-aks-clusterclass"
  const providerName = 'azure'

  const clientID = Cypress.env("azure_client_id")
  const clientSecret = btoa(Cypress.env("azure_client_secret"))
  const subscriptionID = Cypress.env("azure_subscription_id")
  const tenantID = Cypress.env("azure_tenant_id")

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open')
  });

  // TODO: Create Provider via UI, ref: capi-ui-extension/issues/128
  it('Create Azure CAPIProvider', () => {
    cy.removeCAPIResource('Providers', providerName);
    cy.createCAPIProvider(providerName);
    cy.checkCAPIProvider(providerName);
  })

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Disable');
  })

  it('Create AzureClusterIdentity', () => {
    cy.createAzureClusterIdentity(clientID, tenantID, clientSecret);
  })

  qase(84, it('Add CAPZ AKS ClusterClass using fleet', () => {
    cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath, 'capi-classes')
    // Go to CAPI > ClusterClass to ensure the clusterclass is created
    cy.checkCAPIClusterClass(classNamePrefix);
  })
  );

  qase(55,
    it('Import CAPZ AKS class-cluster using YAML', () => {
      cy.readFile('./fixtures/azure/capz-aks-class-cluster.yaml').then((data) => {
        data = data.replace(/replace_cluster_name/g, clusterName)
        data = data.replace(/replace_subscription_id/g, subscriptionID)
        cy.importYAML(data, 'capi-clusters')
      });
      // Check CAPI cluster using its name
      cy.checkCAPICluster(clusterName);
    })
  );

  qase(56, it('Auto import child CAPZ AKS cluster', () => {
    // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
    cy.checkCAPIClusterProvisioned(clusterName, timeout);

    // Check child cluster is created and auto-imported
    // This is checked by ensuring the cluster is available in navigation menu
    cy.goToHome();
    cy.contains(clusterName).should('exist');

    // Check cluster is Active
    cy.searchCluster(clusterName);
    cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });
  })
  );

  if (skipClusterDeletion) {
    qase(60, it('Remove imported CAPZ cluster from Rancher Manager and Delete the CAPZ cluster', () => {
      // Check cluster is not deleted after removal
      cy.deleteCluster(clusterName);
      cy.goToHome();
      // kubectl get clusters.cluster.x-k8s.io
      // This is checked by ensuring the cluster is not available in navigation menu
      cy.contains(clusterName).should('not.exist');
      cy.checkCAPIClusterProvisioned(clusterName);

      // Delete CAPI cluster
      cy.removeCAPIResource('Clusters', clusterName, timeout);
    })
    );
  }

  it('Add CAPZ AKS ClusterClass using fleet for UI Cluster', () => {
    // Remove the previous clusterclass repo
    cy.removeFleetGitRepo(clusterClassRepoName);

    cy.burgerMenuOperate('open')
    cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath, 'capi-clusters') // TODO: Change to capi-classes (capi-ui-extension/issues/111)
    // Go to CAPI > ClusterClass to ensure the clusterclass is created
    cy.checkCAPIClusterClass(classNamePrefix);
  })

  const uiClusterName = clusterName + 'ui'
  qase(45, it('Create CAPZ AKS from Clusterclass via UI', () => {
    // Create cluster from Clusterclass UI
    const machines: Record<string, string> = { 'mp-system': 'default-system', 'mp-worker': 'default-worker' }
    const extraVariables: ClusterClassVariablesInput[] = [
      { name: 'subscriptionID', value: subscriptionID, type: 'string' },
      { name: 'location', value: location, type: 'dropdown' },
      { name: 'resourceGroup', value: clusterName, type: 'string' }

    ]
    cy.createCAPICluster(classNamePrefix, uiClusterName, machines, k8sVersion, podCIDR, undefined, extraVariables);
    cy.checkCAPIMenu();
    cy.contains(new RegExp('Provisioned.*' + uiClusterName), { timeout: timeout });

    // Check child cluster is auto-imported
    cy.clusterAutoImport(uiClusterName, 'Enable');
    cy.searchCluster(uiClusterName);
    cy.contains(new RegExp('Active.*' + uiClusterName), { timeout: timeout });
  })
  );

  qase(57, it('Install App on imported cluster', () => {
    // Click on imported CAPZ cluster
    cy.contains(uiClusterName).click();

    // Install Chart
    cy.checkChart('Install', 'Logging', 'cattle-logging-system');
  })
  );

  if (skipClusterDeletion) {
    qase(89, it('Remove created CAPZ cluster from Rancher Manager and Delete the CAPZ cluster', { retries: 1 }, () => {
      // Check cluster is not deleted after removal
      cy.deleteCluster(uiClusterName);
      cy.goToHome();
      // kubectl get clusters.cluster.x-k8s.io
      // This is checked by ensuring the cluster is not available in navigation menu
      cy.contains(clusterName).should('not.exist');
      cy.checkCAPIClusterProvisioned(uiClusterName);

      // Delete CAPI cluster created via UI
      cy.removeCAPIResource('Clusters', uiClusterName, timeout);
    })
    );

    it('Delete the CAPZ clusterclasses fleet repo and other resources', () => {
      // Remove the clusterclass repo
      cy.removeFleetGitRepo(clusterClassRepoName);

      // Delete secret and AzureClusterIdentity
      cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'AzureClusterIdentities'], 'cluster-identity', 'capi-clusters')
      cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'cluster-identity', namespace)
    })
  }

});
