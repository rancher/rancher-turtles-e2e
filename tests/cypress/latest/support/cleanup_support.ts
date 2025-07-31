Cypress.Commands.add('cleanupFunc', (clusterName, clusterClassRepoName, timeout, extraDeleteSteps = false, clusterRepoName) => {
  // Check cluster is not deleted after removal
  cy.deleteCluster(clusterName);
  cy.goToHome();
  // kubectl get clusters.cluster.x-k8s.io
  // This is checked by ensuring the cluster is not available in navigation menu
  cy.contains(clusterName).should('not.exist');

  // Ensure that the provisioned cluster still exists
  cy.checkCAPIClusterProvisioned(clusterName);


  if (clusterRepoName) {
    // Remove the fleet git repo
    cy.removeFleetGitRepo(clusterRepoName);
    // Wait until the following returns no clusters found
    // This is checked by ensuring the cluster is not available in CAPI menu
    cy.checkCAPIClusterDeleted(clusterName, timeout);
  } else {
    // Delete CAPI cluster created via UI
    cy.removeCAPIResource('Clusters', clusterName, timeout);
  }

  // Remove the clusterclass repo
  cy.removeFleetGitRepo(clusterClassRepoName);

  if (extraDeleteSteps) {
    // Ensure the cluster is not available in navigation menu
    cy.getBySel('side-menu').then(($menu) => {
      if ($menu.text().includes(clusterName)) {
        cy.deleteCluster(clusterName);
      }
    })
  }
})

const capiClustersNS = 'capi-clusters'
const capiClassesNS = 'capi-classes'

Cypress.Commands.add('capzResourcesCleanup', () => {
  cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'AzureClusterIdentities'], 'cluster-identity', capiClustersNS)
  cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'cluster-identity', 'capz-system')
})

Cypress.Commands.add('capaResourcesCleanup', () => {
  // Delete secret and AWSClusterStaticIdentity
  cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'cluster-identity', 'capa-system')
  cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'AWSClusterStaticIdentities'], 'cluster-identity')
})

Cypress.Commands.add('capvResourcesCleanup', (provider) => {
  // Delete secret and VSphereClusterIdentity
  cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'VSphereClusterIdentities'], 'cluster-identity');
  if (provider === 'kubeadm') {
    cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'capv-helm-values', 'capv-system');
  } else {
    cy.deleteKubernetesResource('local', ['Storage', 'Secrets'], "capv-helm-values", 'capv-system')
    cy.deleteKubernetesResource('local', ['Storage', 'Secrets'], "capv-docker-token", capiClustersNS)
  }
})

Cypress.Commands.add('capdResourcesCleanup', (isUI = false) => {
  if (isUI) {
    cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'ConfigMaps'], "cni-docker-kubeadm-example-crs-0", capiClassesNS);
    cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'ClusterResourceSets'], "docker-kubeadm-example-crs-0", capiClassesNS);
  } else {
    cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'ConfigMaps'], "capd-helm-values", 'capi-clusters')
  }
})