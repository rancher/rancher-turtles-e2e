import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { skipClusterDeletion } from '~/support/utils';

Cypress.config();
describe('Import CAPV Kubeadm Class-Cluster', { tags: '@vsphere' }, () => {
  const timeout = 1200000
  const clusterRepoName = 'class-clusters-capv-kb'
  const classRepoName = 'vsphere-kb-clusterclass'
  const className = 'vsphere-kubeadm-example'
  const clusterName = 'turtles-qa-capv-kb-example'
  const branch = 'main'
  const path = '/tests/assets/rancher-turtles-fleet-example/capv/kubeadm/class-clusters'
  const repoUrl = 'https://github.com/rancher/rancher-turtles-e2e.git'
  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/vsphere/kubeadm'
  const vsphere_secrets_json_base64 = Cypress.env("vsphere_secrets_json_base64")
  const namespace = 'capv-system'
  const providerName = 'vsphere'

  // Decode the base64 encoded secrets and make json object
  const vsphere_secrets_json = JSON.parse(Buffer.from(vsphere_secrets_json_base64, 'base64').toString('utf-8'))

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Disable');
  })

  it('Create values.yaml Secret', () => {
    var encodedData = ''
    cy.readFile('./fixtures/capv-helm-values.yaml').then((data) => {
      data = data.replace(/replace_vsphere_server/g, JSON.stringify(vsphere_secrets_json.vsphere_server))
      data = data.replace(/replace_vsphere_username/g, JSON.stringify(vsphere_secrets_json.vsphere_username))
      data = data.replace(/replace_vsphere_password/g, JSON.stringify(vsphere_secrets_json.vsphere_password))
      data = data.replace(/replace_vsphere_datacenter/g, JSON.stringify(vsphere_secrets_json.vsphere_datacenter))
      data = data.replace(/replace_vsphere_datastore/g, JSON.stringify(vsphere_secrets_json.vsphere_datastore))
      data = data.replace(/replace_vsphere_network/g, JSON.stringify(vsphere_secrets_json.vsphere_network))
      data = data.replace(/replace_vsphere_resource_pool/g, JSON.stringify(vsphere_secrets_json.vsphere_resource_pool))
      data = data.replace(/replace_vsphere_folder/g, JSON.stringify(vsphere_secrets_json.vsphere_folder))
      data = data.replace(/replace_vsphere_rke2_template/g, JSON.stringify(vsphere_secrets_json.vsphere_rke2_template))
      data = data.replace(/replace_vsphere_kubeadm_template/g, JSON.stringify(vsphere_secrets_json.vsphere_kubeadm_template))
      data = data.replace(/replace_vsphere_ssh_authorized_key/g, JSON.stringify(vsphere_secrets_json.vsphere_ssh_authorized_key))
      data = data.replace(/replace_vsphere_tls_thumbprint/g, JSON.stringify(vsphere_secrets_json.vsphere_tls_thumbprint))
      // Placeholder 'replace_cluster_control_plane_endpoint_ip' is already replaced at workflow level
      // Anyway it might be helpful for local runs when capv-helm-values.yaml is not modified by the workflow
      if (data.includes('replace_cluster_control_plane_endpoint_ip')) {
        data = data.replace(/replace_cluster_control_plane_endpoint_ip/g, JSON.stringify(vsphere_secrets_json.cluster_control_plane_endpoint_ip))
      }
      encodedData = Buffer.from(data).toString('base64')
    })

    cy.readFile('./fixtures/capv-helm-values-secret.yaml').then((data) => {
      data = data.replace(/replace_values/g, encodedData)
      cy.importYAML(data)
    });
  })

  // TODO: Create Provider via UI, ref: capi-ui-extension/issues/128
  it('Create VSphere CAPIProvider & VSphereClusterIdentity', () => {
    cy.removeCAPIResource('Providers', providerName);
    cy.createCAPIProvider(providerName);
    cy.checkCAPIProvider(providerName);

    const vsphere_username = JSON.stringify(vsphere_secrets_json.vsphere_username).replace(/\"/g, "")
    const vsphere_password = JSON.stringify(vsphere_secrets_json.vsphere_password).replace(/\"/g, "")
    cy.createVSphereClusterIdentity(vsphere_username, vsphere_password)
  })

  it('Add CAPV Kubeadm ClusterClass Fleet Repo and check Applications', () => {
    cy.addFleetGitRepo(classRepoName, turtlesRepoUrl, 'main', classesPath, 'capi-classes')
    // Go to CAPI > ClusterClass to ensure the clusterclass is created
    cy.checkCAPIClusterClass(className);

    // Navigate to `local` cluster, More Resources > Fleet > Helm Apps and ensure the charts are active.
    cy.burgerMenuOperate('open');
    cy.contains('local').click();
    cy.accesMenuSelection(['More Resources', 'Fleet', 'HelmApps']);
    cy.typeInFilter('vsphere-ccm');
    cy.getBySel('sortable-cell-0-1').should('exist');
  });


  it('Add CAPV class-clusters fleet repo', () => {
    cypressLib.checkNavIcon('cluster-management')
      .should('exist');

    // Add CAPV fleet repository
    cy.addFleetGitRepo(clusterRepoName, repoUrl, branch, path);

    // Check CAPI cluster using its name
    cy.checkCAPICluster(clusterName);
  })

  it('Auto import child CAPV cluster', () => {
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

  it('Install App on imported cluster', () => {
    // Click on imported CAPV cluster
    cy.contains(clusterName).click();

    // Install Chart
    // We install Logging chart instead of Monitoring, since this is relatively lightweight.
    cy.checkChart('Install', 'Logging', 'cattle-logging-system');
  })

  if (skipClusterDeletion) {
    it('Remove imported CAPV cluster from Rancher Manager', { retries: 1 }, () => {
      // Check cluster is not deleted after removal
      cy.deleteCluster(clusterName);
      cy.goToHome();
      // kubectl get clusters.cluster.x-k8s.io
      // This is checked by ensuring the cluster is not available in navigation menu
      cy.contains(clusterName).should('not.exist');
      cy.checkCAPIClusterProvisioned(clusterName);
    })

    it('Delete the CAPV cluster and ClusterClass fleet repo', () => {
      // Remove the fleet git repo
      cy.removeFleetGitRepo(clusterRepoName);
      // Wait until the following returns no clusters found
      // This is checked by ensuring the cluster is not available in CAPI menu
      cy.checkCAPIClusterDeleted(clusterName, timeout);

      // Remove the clusterclass repo
      cy.removeFleetGitRepo(classRepoName);

      // Delete secret and VSphereClusterIdentity
      cy.deleteKubernetesResource('local', ['More Resources', 'Cluster Provisioning', 'VSphereClusterIdentities'], 'cluster-identity');
      cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'Secrets'], 'capv-helm-values', namespace);
    })
  }
});
