import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';

Cypress.config();
describe('Import CAPV', { tags: '@vsphere' }, () => {
  const timeout = 1200000
  const repoName = 'clusters-capv'
  const clusterName = "turtles-qa-capv-rke2"
  const branch = 'main'
  const path = '/tests/assets/rancher-turtles-fleet-example/vsphere_rke2'
  const repoUrl = "https://github.com/thehejik/rancher-turtles-e2e.git" // CHANGE THIS TO 'rancher/rancher-turtles-e2e' ONCE IT'S MERGED
  const vsphere_secrets_json_base64 = Cypress.env("vsphere_secrets_json_base64")

  // The `vsphere_secrets_json_base64` environment variable must be stored in GitHub Actions Secrets and BASE64 encoded.
  // export VSPHERE_SECRETS_JSON_BASE64=$(echo '
  //   {
  //     "vsphere_server": "replace_vsphere_server",
  //     "vsphere_username": "replace_vsphere_username",
  //     "vsphere_password": "replace_vsphere_password",
  //     "vsphere_datacenter": "replace_vsphere_datacenter",
  //     "vsphere_datastore": "replace_vsphere_datastore",
  //     "vsphere_network": "replace_vsphere_network",
  //     "vsphere_resource_pool": "replace_vsphere_resource_pool",
  //     "vsphere_folder": "replace_vsphere_folder",
  //     "vsphere_template": "replace_vsphere_templae",
  //     "vsphere_ssh_authorized_key": "replace_vsphere_ssh_authorized_key",
  //     "vsphere_tls_thumbprint": "replace_vsphere_tls_thumbprint",
  //     "cluster_control_plane_endpoint_ip": "replace_cluster_control_plane_endpoint_ip"
  //   }' | jq | base64 -w0)

  // Decode the base64 encoded secrets and make json object
  const vsphere_secrets_json = JSON.parse(Buffer.from(vsphere_secrets_json_base64, 'base64').toString('utf-8'))

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Enable');
  })

  it('Create values.yaml Secret', () => {
    cy.contains('local')
      .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
      .click();
    cy.contains('Import YAML');
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
      data = data.replace(/replace_vsphere_template/g, JSON.stringify(vsphere_secrets_json.vsphere_template))
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
      cy.get('.CodeMirror')
        .then((editor) => {
          data = data.replace(/replace_values/g, encodedData)
          editor[0].CodeMirror.setValue(data);
        })
    });

    cy.clickButton('Import');
    cy.clickButton('Close');

  })

  it('Add CAPV cluster fleet repo', () => {
    cypressLib.checkNavIcon('cluster-management')
      .should('exist');

    // Add CAPZ fleet repository
    cy.addFleetGitRepo(repoName, repoUrl, branch, path);

    // Go to Cluster Management > CAPI > Clusters and check if the cluster has started provisioning
    cypressLib.burgerMenuToggle();
    cy.checkCAPIMenu();
    cy.contains(new RegExp('Provisioned.*' + clusterName), { timeout: timeout });
  })

  it('Auto import child CAPV cluster', () => {
    // Check child cluster is created and auto-imported
    cy.goToHome();
    cy.contains(new RegExp('Pending.*' + clusterName));

    // Check cluster is Active
    cy.searchCluster(clusterName);
    cy.contains(new RegExp('Active.*' + clusterName), { timeout: 300000 });
  })

  it('Install App on imported cluster', { retries: 1 }, () => {
    // Click on imported CAPV cluster
    cy.contains(clusterName).click();

    // Install Chart
    cy.checkChart('Install', 'Monitoring', 'cattle-monitoring');
  })

  it("Scale up imported CAPV cluster by updating values and forcefully updating the repo", () => {
    cy.contains('local')
      .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
      .click();
    cy.contains('Import YAML');

    var encodedData = ''
    cy.readFile('./fixtures/capv-helm-values.yaml').then((data) => {
      data = data.replace(/control_plane_machine_count: 1/g, "control_plane_machine_count: 2")
      data = data.replace(/worker_machine_count: 1/g, "worker_machine_count: 2")

      // workaround; these values need to be re-replaced before applying the scaling changes
      data = data.replace(/replace_vsphere_server/g, JSON.stringify(vsphere_secrets_json.vsphere_server))
      data = data.replace(/replace_vsphere_username/g, JSON.stringify(vsphere_secrets_json.vsphere_username))
      data = data.replace(/replace_vsphere_password/g, JSON.stringify(vsphere_secrets_json.vsphere_password))
      data = data.replace(/replace_vsphere_datacenter/g, JSON.stringify(vsphere_secrets_json.vsphere_datacenter))
      data = data.replace(/replace_vsphere_datastore/g, JSON.stringify(vsphere_secrets_json.vsphere_datastore))
      data = data.replace(/replace_vsphere_network/g, JSON.stringify(vsphere_secrets_json.vsphere_network))
      data = data.replace(/replace_vsphere_resource_pool/g, JSON.stringify(vsphere_secrets_json.vsphere_resource_pool))
      data = data.replace(/replace_vsphere_folder/g, JSON.stringify(vsphere_secrets_json.vsphere_folder))
      data = data.replace(/replace_vsphere_template/g, JSON.stringify(vsphere_secrets_json.vsphere_template))
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
      cy.get('.CodeMirror')
        .then((editor) => {
          data = data.replace(/replace_values/g, encodedData)
          editor[0].CodeMirror.setValue(data);
        })
    });

    cy.clickButton('Import');
    cy.clickButton('Close');

    cypressLib.burgerMenuToggle();
    cy.forceUpdateFleetGitRepo(repoName)

    // TODO: check if the cluster is actually updated
    // TODO: Wait until the fleet repo is ready
    // Go to Cluster Management > CAPI > Clusters and check if the cluster has started provisioning
    cypressLib.burgerMenuToggle();
    cy.checkCAPIMenu();
    cy.contains(new RegExp('Provisioned.*' + clusterName), { timeout: timeout });
  })

  it('Remove imported CAPV cluster from Rancher Manager', { retries: 1 }, () => {
    // Check cluster is not deleted after removal
    cy.deleteCluster(clusterName);
    cy.goToHome();
    // kubectl get clusters.cluster.x-k8s.io
    // This is checked by ensuring the cluster is not available in navigation menu
    cy.contains(clusterName).should('not.exist');
    cy.checkCAPIClusterProvisioned(clusterName);
  })

  it('Delete the CAPV cluster fleet repo', () => {
    // Remove the fleet git repo
    cy.removeFleetGitRepo(repoName)
    // Wait until the following returns no clusters found
    // This is checked by ensuring the cluster is not available in CAPI menu
    cy.checkCAPIClusterDeleted(clusterName, timeout);
  })
});
