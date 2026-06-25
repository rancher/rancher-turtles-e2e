import {vars} from '../support/variables';

export const v3ClusterDeleteCommand = (clusterName: string): string => {
  return `kubectl delete clusters.management.cattle.io -l cluster-api.cattle.io/capi-cluster-owner=${clusterName} -l cluster-api.cattle.io/capi-cluster-owner-ns=${vars.capiClustersNS}`;
};

export const reImportClusterPatchCommand = (clusterName: string): string => {
  return `kubectl -n ${vars.capiClustersNS} patch clusters.cluster.x-k8s.io ${clusterName} --type="json" -p='[{"op":"remove","path":"/metadata/annotations/imported"}]'`;
};

export function importedRancherv3ClusterDeletion(clusterName: string) {
  // Verify the imported cluster is present before deletion
  cy.searchCluster(clusterName);
  cy.get('table.sortable-table tbody tr').then(($rows) => {
    if ($rows.filter('.no-results').length > 0) {
      cy.task('suiteLog', 'Skipping imported Rancherv3Cluster deletion, cluster not found')
      return;
    }

    // Delete the imported mgmt v3 cluster from Cluster Management using kubectl
    cy.kubectlExecute([v3ClusterDeleteCommand(clusterName)]);

    // Ensure the cluster is not available on the home page
    cy.goToHome();
    cy.contains(clusterName).should('not.exist');

    // Ensure that the provisioned cluster/ CAPI resource related to the cluster still exists
    cy.checkCAPIClusterProvisioned(clusterName);

    // Check the annotation is set on CAPI cluster
    cy.viewCAPIClusterYAML(clusterName);
    cy.get('.CodeMirror').then((editor) => {
      // @ts-expect-error known error with CodeMirror
      const text = editor[0].CodeMirror.getValue();
      expect(text).to.include("imported: 'true'");
    });
  });
}

export function reImportRancherv3Cluster(clusterName: string) {
  // Re-import the deleted mgmt v3 cluster in Cluster Management using kubectl
  cy.kubectlExecute([reImportClusterPatchCommand(clusterName)]);

  // Check child cluster is auto-imported
  // This is checked by ensuring the cluster is available in navigation menu
  cy.goToHome();
  cy.contains(clusterName).should('exist');

  // Check cluster is Active
  cy.searchCluster(clusterName);
  cy.contains(new RegExp('Active.*' + clusterName), {timeout: vars.shortTimeout});
}

export function capiClusterDeletion(clusterName: string, timeout: number, clusterRepoName?: string, extraDeleteSteps: boolean = false) {
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

export function capzResourcesCleanup(aso: boolean = false) {
  if (aso) {
    cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'aso-credential-secret', capiClustersNS)
  } else {
    cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'AzureClusterIdentities'], 'cluster-identity', capiClustersNS)
    cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'cluster-identity', 'capz-system')
  }
}

export function capaResourcesCleanup() {
  // Delete secret and AWSClusterStaticIdentity
  cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'cluster-identity', 'capa-system')
  cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'AWSClusterStaticIdentities'], 'cluster-identity')
}

export function capvResourcesCleanup(provider: 'kubeadm' | 'rke2') {
  // Delete secret and VSphereClusterIdentity
  cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'VSphereClusterIdentities'], 'cluster-identity');
  cy.deleteKubernetesResource('local', ['Storage', 'Secrets'], "capv-helm-values", 'capv-system')
  if (provider === 'rke2') {
    cy.deleteKubernetesResource('local', ['Storage', 'Secrets'], "capv-docker-token", capiClustersNS)
  }
}

export function capdResourcesCleanup() {
  cy.deleteKubernetesResource('local', ['Storage', 'Secrets'], 'capd-docker-token', capiClustersNS)
}
