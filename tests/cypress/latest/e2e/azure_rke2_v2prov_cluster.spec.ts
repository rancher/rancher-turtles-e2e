import '~/support/commands';
import {qase} from 'cypress-qase-reporter/dist/mocha';
import {skipClusterDeletion} from '~/support/utils';
import * as randomstring from "randomstring";

Cypress.config();
describe('Create Azure RKE2 Cluster', { tags: '@short' }, () => {
  let userID: string, ccID: string;
  const timeout = 1200000
  const userName = 'admin'
  const k8sVersion = 'v1.31.7+rke2r1'
  const clusterName = 'turtles-qa-azure-v2-' + randomstring.generate({ length: 4, capitalization: "lowercase" })

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open')
  });

  it('Create Azure Cloud credentials', () => {
    // Create Azure Cloud credentials
    cy.addCloudCredsAzure('azure', Cypress.env('azure_client_id'), Cypress.env('azure_client_secret'), Cypress.env('azure_subscription_id'));
  })

  it('Get user ID and Cloud credential ID', () => {
    cy.accesMenuSelection(['Users & Authentication']);
    cy.getBySel('router-link-user-retention').should('be.visible');
    cy.typeInFilter(userName);
    // Get the user id
    cy.getBySel('sortable-cell-0-1').then(($cell) => {
      userID = String($cell.text());
      cy.log('User ID:', userID);
    });

    cy.burgerMenuOperate('open');
    cy.accesMenuSelection(['Cluster Management', 'Cloud Credentials']);
    cy.getBySel('sortable-table-list-container').should('be.visible');
    cy.typeInFilter('azure');
    // Get the CC id
    cy.getBySel('sortable-cell-0-0').then(($cell) => {
      ccID = $cell.text();
      cy.log('Cloud credential ID:', ccID);
    });
  })

  it('Create the AzureConfig', () => {
    cy.readFile('./fixtures/azure/azure-rke-config.yaml').then((data) => {
      data = data.replace(/replace_user_id/g, userID)
      data = data.replace(/replace_cluster_name/g, clusterName)
      cy.importYAML(data)
    });
  })

  // Create Azure RKE2 Cluster using YAML
  qase(132, it('Create Azure RKE2 Cluster', () => {
    cy.goToHome();
    cy.clickButton('Manage');
    cy.getBySel('cluster-list').should('be.visible');
    cy.clickButton('Create');

    cy.getBySel('cluster-manager-create-grid-Azure')
      .should('be.visible')
      .click();

    cy.getBySel('name-ns-description-name').should('be.visible');
    cy.getBySel('rke2-custom-create-yaml').click();
    cy.clickButton('Save and Continue');
    cy.getBySel('yaml-editor-code-mirror').should('be.visible');

    cy.readFile('./fixtures/azure/azure-rke2-cluster.yaml').then((data) => {
      cy.get('.CodeMirror')
        .then((editor) => {
          data = data.replace(/replace_user_id/g, userID)
          data = data.replace(/replace_cluster_name/g, clusterName)
          data = data.replace(/replace_cloudcred_id/g, ccID)
          data = data.replace(/replace_rke2_version/g, k8sVersion)
          // @ts-expect-error expected error with CodeMirror
          editor[0].CodeMirror.setValue(data);
        })
    });
    cy.clickButton('Create');
    cy.getBySel('cluster-list').should('be.visible');

    // Check cluster is Active
    cy.searchCluster(clusterName);
    cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });

    // Check provisioning status
    cy.getBySel('sortable-cell-0-1').click();
    cy.getBySel('log').click();
    cy.contains('[INFO ] provisioning done');
  })
  );

  if (skipClusterDeletion) {
    it('Delete Azure RKE2 cluster from Rancher Manager', () => {
      cy.deleteCluster(clusterName, timeout);
      cy.goToHome();
      // kubectl get clusters.cluster.x-k8s.io
      // This is checked by ensuring the cluster is not available in navigation menu
      cy.contains(clusterName).should('not.exist');
    })
  }
});
