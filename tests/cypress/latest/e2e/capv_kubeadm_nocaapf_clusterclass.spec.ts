import '../support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import {isRancherManagerVersion, skipClusterDeletion, getCAPIClusterKubeconfig, applyYAMLManifest} from '../support/utils';
import {capiClusterDeletion, capvResourcesCleanup, importedRancherv3ClusterDeletion} from "../support/cleanup_support";
import {vars} from '../support/variables';

Cypress.config();
describe('Import CAPV Kubeadm (No-Caapf) Class-Cluster', {tags: ['@vsphere', '@vsphere-nocaapf', '@capvk-nocaapf']}, () => {
  const timeout = vars.fullTimeout
  const clusterRepoName = 'class-clusters-capv-kb-nocaapf'
  const classRepoName = 'vsphere-kb-clusterclass-nocaapf'
  const className = 'vsphere-kubeadm-example'
  const clusterName = 'turtles-qa-capv-kb-nocaapf'
  const path = '/tests/assets/rancher-turtles-fleet-example/capv/kubeadm/class-clusters-nocaapf'
  const classesPath = 'examples/clusterclasses/vsphere/kubeadm'
  const vsphere_secrets_json_base64 = Cypress.expose("vsphere_secrets_json_base64")

  // Decode the base64 encoded secrets and make json object
  const vsphere_secrets_json = JSON.parse(Buffer.from(vsphere_secrets_json_base64, 'base64').toString('utf-8'))

  before(function () {
    if (isRancherManagerVersion('<2.15')) {
      return cy.task('suiteLog', "NoCAAPF is unsupported on Rancher Version <2.15; skipping...").then(() => {
        this.skip();
      })
    }
  })

  beforeEach(function () {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('[SETUP]', () => {
    qase(284, it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    })
    );

    qase(285, it('Create values.yaml Secret', () => {
      let encodedData = ''
      cy.readFile('./fixtures/vsphere/capv-helm-values.yaml').then((data) => {
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

      cy.readFile('./fixtures/vsphere/capv-helm-values-secret.yaml').then((data) => {
        data = data.replace(/replace_values/g, encodedData)
        cy.importYAML(data)
      })
    })
    );

    qase(286, it('Create VSphereClusterIdentity', () => {
      const vsphere_username = JSON.stringify(vsphere_secrets_json.vsphere_username).replace(/\"/g, "")
      const vsphere_password = JSON.stringify(vsphere_secrets_json.vsphere_password).replace(/\"/g, "")
      cy.createVSphereClusterIdentity(vsphere_username, vsphere_password)
    })
    );

    qase(287, it('Add CAPV Kubeadm ClusterClass Fleet Repo', () => {
      cy.addFleetGitRepo(classRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(className);
    })
    );
  })

  context('[CLUSTER-IMPORT]', () => {
    qase(288, it('Add CAPV class-clusters fleet repo', () => {
      cypressLib.checkNavIcon('cluster-management')
        .should('exist');

      // Add CAPV fleet repository
      cy.addFleetGitRepo(clusterRepoName, vars.repoUrl, vars.branch, path);

      // Check CAPI cluster using its name
      cy.checkCAPICluster(clusterName);

      // Check CAPI cluster status
      cy.checkCAPIClusterCPInitialized(clusterName);
    })
    );

    it('Apply the CNI, CCM & CSI manifest', () => {
      cy.kubectlExecute([getCAPIClusterKubeconfig(clusterName), applyYAMLManifest(clusterName, vars.calicoCNIYaml), applyYAMLManifest(clusterName, vars.vSphereCCMYaml), applyYAMLManifest(clusterName, vars.vSphereCSIYaml)]);
    })

    qase(289, it('Auto import child CAPV cluster', () => {
      // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
      cy.checkCAPIClusterProvisioned(clusterName, timeout);

      // Check child cluster is created and auto-imported
      // This is checked by ensuring the cluster is available in navigation menu
      cy.goToHome();
      cy.contains(clusterName).should('exist');

      // Check cluster is Active
      cy.searchCluster(clusterName);
      cy.contains(new RegExp('Active.*' + clusterName), {timeout: timeout});

      // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
      // Ensuring cluster is provisioned also ensures all the Cluster Management > Advanced > Machines for the given cluster are Active.
      cy.checkCAPIClusterActive(clusterName, timeout);
    })
    );
  })

  context('[CLUSTER-OPERATIONS]', () => {
    qase(290, (isRancherManagerVersion('>2.14') ? it.skip : it)('Install App on imported cluster', {retries: 1}, () => {
      cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
    })
    );

    it('Check for any errors in Turtles logs', () => {
      // Check for any errors
      cy.filterPodErrorLogs('rancher-turtles-controller-manager');
    })
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
      qase(359, it('Remove imported CAPV cluster from Rancher Manager', () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        importedRancherv3ClusterDeletion(clusterName);
      })
      );

      qase(292, it('Delete the CAPV cluster', {retries: 1}, () => {
        // Remove CAPI Resources related to the cluster
        capiClusterDeletion(clusterName, timeout, clusterRepoName);
      })
      );

      qase(293, it('Delete the ClusterClass fleet repo and other resources', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(classRepoName);
        // Cleanup other resources
        capvResourcesCleanup('kubeadm');
      })
      );
    }
  })
});
