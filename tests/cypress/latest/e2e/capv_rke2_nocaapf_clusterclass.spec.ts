import '../support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import {isRancherManagerVersion, skipClusterDeletion} from '../support/utils';
import {capiClusterDeletion, capvResourcesCleanup, importedRancherv3ClusterDeletion} from "../support/cleanup_support";
import {vars} from '../support/variables';

Cypress.config();
describe('Import CAPV RKE2 (No-Caapf) Class-Cluster', {tags: ['@vsphere', '@vsphere-nocaapf', '@capvr-nocaapf']}, () => {
  const timeout = vars.fullTimeout
  const clusterRepoName = 'class-clusters-capv-rke2-nocaapf'
  const classRepoName = 'vsphere-rke2-clusterclass-nocaapf'
  const className = 'vsphere-rke2-example'
  const clusterName = 'turtles-qa-capv-rke2-nocaapf'
  const path = '/tests/assets/rancher-turtles-fleet-example/capv/rke2/class-clusters-nocaapf'
  const classesPath = 'examples/clusterclasses/vsphere/rke2'
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
    qase(273, it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    })
    );

    qase(274, it('Create values.yaml Secret', () => {
      let encodedData = ''
      cy.readFile('./fixtures/vsphere/capv-helm-values.yaml').then((data) => {
        // Deploy HA cluster with 3 control plane and 3 worker nodes, instead of default 1+1
        data = data.replace(/control_plane_machine_count: 1/g, "control_plane_machine_count: 3")
        data = data.replace(/worker_machine_count: 1/g, "worker_machine_count: 3")
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
        // This is not mandatory field, usable for SLE only
        if (vsphere_secrets_json.cluster_product_key) {
          const productKeyValue = vsphere_secrets_json.cluster_product_key
          data = data.replace(/product_key:.*/, `product_key: "${productKeyValue}"`);
        }
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
      });
    })
    );

    qase(275, it('Create VSphereClusterIdentity', () => {
      const vsphere_username = JSON.stringify(vsphere_secrets_json.vsphere_username).replace(/\"/g, "")
      const vsphere_password = JSON.stringify(vsphere_secrets_json.vsphere_password).replace(/\"/g, "")
      cy.createVSphereClusterIdentity(vsphere_username, vsphere_password)
    })
    );

    qase(276, it('Create Docker Auth Secret', () => {
      // Prevention for Docker.io rate limiting
      cy.readFile('./fixtures/vsphere/capv-docker-auth-token-secret.yaml').then((data) => {
        const dockerAuthPasswordBase64 = Buffer.from(vsphere_secrets_json.cluster_docker_auth_password).toString('base64')
        const dockerAuthUsernameBase64 = Buffer.from(vsphere_secrets_json.cluster_docker_auth_username).toString('base64')
        data = data.replace(/replace_cluster_docker_auth_username/, dockerAuthUsernameBase64)
        data = data.replace(/replace_cluster_docker_auth_password/, dockerAuthPasswordBase64)
        cy.importYAML(data, vars.capiClustersNS)
      })
    })
    );

    qase(277, it('Add CAPV RKE2 ClusterClass Fleet Repo and check Applications', () => {
      cy.addFleetGitRepo(classRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(className);
    })
    );
  })

  context('[CLUSTER-IMPORT]', () => {
    qase(278, it('Add CAPV class-clusters fleet repo', () => {
      cypressLib.checkNavIcon('cluster-management')
        .should('exist');

      // Add CAPV fleet repository
      cy.addFleetGitRepo(clusterRepoName, vars.repoUrl, vars.branch, path);

      // Check CAPI cluster using its name
      cy.checkCAPICluster(clusterName);
    })
    );

    qase(279, it('Auto import child CAPV cluster', () => {
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

      // Block until all 6 nodes are Active - this is important for kube-vip leader election test
      cy.verifyResourceCount(clusterName, ['Nodes'], clusterName, '', 6); // '' means no namespace
      cy.waitForAllRowsInState('Active', 300000);
    })
    );
  })

  context('[CLUSTER-OPERATIONS]', () => {
    qase(280, (isRancherManagerVersion('>2.14') ? it.skip : it)('Install App on imported cluster', {retries: 1}, () => {
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
      qase(358, it('Remove imported CAPV cluster from Rancher Manager', () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        importedRancherv3ClusterDeletion(clusterName);
      })
      );

      qase(282, it('Delete the CAPV cluster', {retries: 1}, () => {
        // Remove CAPI Resources related to the cluster
        capiClusterDeletion(clusterName, timeout, clusterRepoName);
      })
      );

      qase(283, it('Delete the ClusterClass fleet repo and other resources', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(classRepoName);
        // Cleanup other resources
        capvResourcesCleanup('rke2')
      })
      );
    }
  })
});
