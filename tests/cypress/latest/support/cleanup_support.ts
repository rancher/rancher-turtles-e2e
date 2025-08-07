export function importedClusterCleanup(clusterName: string) {
  // Delete the imported cluster from Cluster Management
  cy.deleteCluster(clusterName);


  // Ensure the cluster is not available on the home page
  cy.goToHome();
  cy.contains(clusterName).should('not.exist');

  // Ensure that the provisioned cluster/ CAPI resource related to the cluster still exists
  cy.checkCAPIClusterProvisioned(clusterName);
}

export function clusterCAPIResourceCleanup(clusterName: string, timeout: number, clusterRepoName?: string,extraDeleteSteps:boolean=false) {
  if (clusterRepoName) {
    // Remove the fleet git repo used to add cluster CAPI resources
    cy.removeFleetGitRepo(clusterRepoName);
    // Wait until the following returns no clusters found
    // This is checked by ensuring the cluster is not available in the CAPI menu
    cy.checkCAPIClusterDeleted(clusterName, timeout);
  } else {
    // Delete CAPI cluster created via UI
    cy.removeCAPIResource('Clusters', clusterName, timeout);
  }

  if (extraDeleteSteps){
    // Ensure the cluster is not available in navigation menu
    cy.getBySel('side-menu').then(($menu) => {
      if ($menu.text().includes(clusterName)) {
        cy.deleteCluster(clusterName);
      }
    })
  }
}

const capiClustersNS = 'capi-clusters'
const capiClassesNS = 'capi-classes'

export function capzResourcesCleanup() {
  cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'AzureClusterIdentities'], 'cluster-identity', capiClustersNS)
  cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'cluster-identity', 'capz-system')
}

export function capaResourcesCleanup() {
  // Delete secret and AWSClusterStaticIdentity
  cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'cluster-identity', 'capa-system')
  cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'AWSClusterStaticIdentities'], 'cluster-identity')
}

export function capvResourcesCleanup(provider: 'kubeadm' | 'rke2') {
  // Delete secret and VSphereClusterIdentity
  cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'VSphereClusterIdentities'], 'cluster-identity');
  if (provider === 'kubeadm') {
    cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'capv-helm-values', 'capv-system');
  } else {
    cy.deleteKubernetesResource('local', ['Storage', 'Secrets'], "capv-helm-values", 'capv-system')
    cy.deleteKubernetesResource('local', ['Storage', 'Secrets'], "capv-docker-token", capiClustersNS)
  }
}

export function capdResourcesCleanup() {
    cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'ConfigMaps'], "cni-docker-kubeadm-example-crs-0", capiClassesNS);
    cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'ClusterResourceSets'], "docker-kubeadm-example-crs-0", capiClassesNS);
}
