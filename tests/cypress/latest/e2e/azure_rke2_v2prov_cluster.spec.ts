import '~/support/commands';
import {qase} from 'cypress-qase-reporter/mocha';
import {isAPIv1beta1, isRancherManagerVersion, skipClusterDeletion} from '~/support/utils';
import * as randomstring from "randomstring";
import {vars} from '~/support/variables';

Cypress.config();
describe('Create Azure RKE2 Cluster', {tags: ['@short', '@migration']}, () => {
  let userID: string, ccID: string;
  let features = ['turtles']
  const timeout = vars.fullTimeout
  const userName = 'admin'
  const k8sVersion = vars.rke2Version
  const clusterName = 'turtles-qa-azure-v2-' + randomstring.generate({length: 4, capitalization: "lowercase"})

  if (isRancherManagerVersion('>=2.13')) {
    features.push('embedded-cluster-api');
  }

  beforeEach(() => {
    if (!isAPIv1beta1) {
      cy.task('log', 'Skipping the test until Rancher CAPI (v2prov) is bumped to v1.11.5');
      this.skip();
    }
    cy.login();
    cy.burgerMenuOperate('open')
  });

  context('[SETUP]', () => {
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
        cy.task('log', `User ID: ${userID}`);
      });

      cy.burgerMenuOperate('open');
      cy.accesMenuSelection(['Cluster Management', 'Cloud Credentials']);
      cy.getBySel('sortable-table-list-container').should('be.visible');
      cy.typeInFilter('azure');
      // Get the CC id
      cy.getBySel('sortable-cell-0-0').then(($cell) => {
        ccID = $cell.text();
        cy.task('log', `Cloud credential ID: ${ccID}`);
      });
    })
  })

  features.forEach((feature) => {
    context('[CLUSTER-IMPORT]', () => {
      it('Create the AzureConfig', () => {
        cy.readFile('./fixtures/azure/azure-rke-config.yaml').then((data) => {
          data = data.replace(/replace_user_id/g, userID)
          data = data.replace(/replace_cluster_name/g, clusterName)
          cy.importYAML(data)
        });
      })

      // Create Azure RKE2 Cluster using YAML
      qase(132,
        it('Create Azure RKE2 Cluster with feature - ' + feature, () => {
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
          cy.contains(new RegExp('Active.*' + clusterName), {timeout: timeout});

          // Check provisioning status
          cy.getBySel('sortable-cell-0-1').click();
          cy.getBySel('log').click();
          cy.contains('[INFO ] provisioning done');

          if (isRancherManagerVersion('>=2.13')) {
            // Switch the features
            if (feature == 'turtles') {
              cy.setCAPIFeature('embedded-cluster-api', 'true');
              cy.setCAPIFeature(feature, 'false');
            } else {
              cy.setCAPIFeature('turtles', 'true');
            }
          }
          // Check cluster is Active
          cy.searchCluster(clusterName);
          cy.contains(new RegExp('Active.*' + clusterName), {timeout: timeout});
        })
      );
    })

    context('[TEARDOWN]', () => {
      if (skipClusterDeletion) {
        it('Delete Azure RKE2 cluster from Rancher Manager', () => {
          cy.deleteCluster(clusterName, timeout);
          cy.goToHome();
          // kubectl get clusters.cluster.x-k8s.io
          // This is checked by ensuring the cluster is not available in navigation menu
          cy.contains(clusterName).should('not.exist');
        })
      }
    })
  })
});
