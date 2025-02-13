import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';

Cypress.config();
describe('Import/Create CAPZ', { tags: '@full' }, () => {
  const timeout = 1200000
  const repoName = 'clusters-capz'
  const clusterName = "turtles-qa-capz"
  const className = 'quick-start'
  const machineName = 'default-system'
  const k8sVersion = 'v1.30.0'
  const podCIDR = '192.168.0.0/16'
  const branch = 'fleet-example'
  const path = '/tests/assets/rancher-turtles-fleet-example/capz/aks'
  const repoUrl = "https://github.com/rancher/rancher-turtles-e2e.git"
  const clientID = Cypress.env("azure_client_id")
  const clientSecret = btoa(Cypress.env("azure_client_secret"))
  const subscriptionID = Cypress.env("azure_subscription_id")
  const tenantID = Cypress.env("azure_tenant_id")
  const location = Cypress.env("azure_location")

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Enable');
  })

  it('Create azure cluster identity Secret', () => {
    //  Creating this secret separately and not as a part of the helmchart ensures that the cluster is deleted successfully
    cy.contains('local')
      .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
      .click();
    cy.contains('Import YAML');
    cy.readFile('./fixtures/capz-client-secret.yaml').then((data) => {
      cy.get('.CodeMirror')
        .then((editor) => {
          data = data.replace(/replace_client_secret/g, clientSecret)
          editor[0].CodeMirror.setValue(data);
        })
    });
    cy.clickButton('Import');
    cy.clickButton('Close');

    // This secret is currently not deleted at the end of test.
  })


  it('Create values.yaml Secret', () => {
    cy.contains('local')
      .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
      .click();
    cy.contains('Import YAML');
    var encodedData = ''
    cy.readFile('./fixtures/capz-helm-values.yaml').then((data) => {
      data = data.replace(/replace_location/g, location)
      data = data.replace(/replace_client_id/g, clientID)
      data = data.replace(/replace_tenant_id/g, tenantID)
      data = data.replace(/replace_subscription_id/g, subscriptionID)
      encodedData = btoa(data)
    })

    cy.readFile('./fixtures/capz-helm-values-secret.yaml').then((data) => {
      cy.get('.CodeMirror')
        .then((editor) => {
          data = data.replace(/replace_values/g, encodedData)
          editor[0].CodeMirror.setValue(data);
        })
    });

    cy.clickButton('Import');
    cy.clickButton('Close');

  })

  qase(21, it('Add CAPZ cluster fleet repo', () => {
    cypressLib.checkNavIcon('cluster-management')
      .should('exist');

    // Add CAPZ fleet repository
    cy.addFleetGitRepo(repoName, repoUrl, branch, path);

    // Go to Cluster Management > CAPI > Clusters and check if the cluster has started provisioning
    cypressLib.burgerMenuToggle();
    cy.checkCAPIMenu();
    cy.contains(new RegExp('Provisioned.*' + clusterName), { timeout: timeout });
  })
  );

  qase(22, it('Auto import child CAPZ cluster', () => {
    // Check child cluster is created and auto-imported
    cy.goToHome();
    cy.contains(new RegExp('Pending.*' + clusterName));

    // Check cluster is Active
    cy.searchCluster(clusterName);
    cy.contains(new RegExp('Active.*' + clusterName), { timeout: 300000 });
  })
  );
  qase(23, it('Install App on imported cluster', { retries: 1 }, () => {
    // Click on imported CAPZ cluster
    cy.contains(clusterName).click();

    // Install Chart
    cy.checkChart('Install', 'Monitoring', 'cattle-monitoring');
  })
  );

  qase(24, xit("Scale up imported CAPZ cluster by updating configmap and forcefully updating the repo", () => {
    cy.contains('local')
      .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
      .click();
    cy.contains('Import YAML');

    var encodedData = ''
    cy.readFile('./fixtures/capz-helm-values.yaml').then((data) => {
      data = data.replace(/systempoolCount: 1/g, "systempoolCount: 2")
      data = data.replace(/userpoolCount: 2/g, "userpoolCount: 4")

      // workaround; these values need to be re-replaced before applying the scaling changes
      data = data.replace(/replace_location/g, location)
      data = data.replace(/replace_client_id/g, clientID)
      data = data.replace(/replace_tenant_id/g, tenantID)
      data = data.replace(/replace_subscription_id/g, subscriptionID)
      encodedData = btoa(data)
    })

    cy.readFile('./fixtures/capz-helm-values-secret.yaml').then((data) => {
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
    cy.contains('Provisioned ' + clusterName, { timeout: timeout });
  })
  );

  qase(25, it('Remove imported CAPZ cluster from Rancher Manager and Delete the CAPZ cluster', { retries: 1 }, () => {

    // Check cluster is not deleted after removal
    cy.deleteCluster(clusterName);
    cy.goToHome();
    // kubectl get clusters.cluster.x-k8s.io
    // This is checked by ensuring the cluster is not available in navigation menu
    cy.contains(clusterName).should('not.exist');
    cy.checkCAPIClusterProvisioned(clusterName);

    // Delete CAPI cluster created from Fleet
    cy.deleteCAPICluster(clusterName, timeout);
  })
  );

  qase(44, it('Create CAPZ from Clusterclass', () => {
    // Create cluster from Clusterclass UI
    cy.createCAPICluster(className, clusterName, machineName, k8sVersion, podCIDR);
    cy.checkCAPIMenu();
    cy.contains(new RegExp('Provisioned.*' + clusterName), { timeout: timeout });

    // Check child cluster is auto-imported
    cy.searchCluster(clusterName);
    cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });
  })
  );

  qase(26, it('Delete the CAPZ cluster fleet repo', () => {

    // Remove the fleet git repo
    cy.removeFleetGitRepo(repoName)
    // Wait until the following returns no clusters found
    // This is checked by ensuring the cluster is not available in CAPI menu
    cy.checkCAPIClusterDeleted(clusterName, timeout);
    cy.deleteCAPIClusterClass(className);
  })
  );

});
