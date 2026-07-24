/*
Copyright © 2022 - 2023 SUSE LLC
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import '../support/commands';
import {
  capiNamespace,
  isCypressTag,
  isRancherManagerVersion, isTurtlesDevChart,
  isUpgrade,
  turtlesNamespace,
} from '../support/utils';
import {providers, vars} from '../support/variables';
import {matchAndWaitForProviderReadyStatus} from "../support/commands";

Cypress.config();
describe('Enable CAPI Providers', () => {
  const providerTypes = ['bootstrap', 'control plane']
  const kubeadmProviderNamespaces = ['capi-kubeadm-bootstrap-system', 'capi-kubeadm-control-plane-system']

  before(function () {
    if (isRancherManagerVersion('2.12')) {
      return cy.task('suiteLog', 'Skipping for 2.12 Rancher versions').then(() => {
        this.skip();
      })
    }
  })

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('Local providers - @install', {tags: '@install'}, () => {
    // HelmOps to be used across all specs
    qase(90, it('Add Applications fleet repo', () => {
      // Add upstream apps repo
      cy.addFleetGitRepo('helm-ops', vars.turtlesRepoUrl, vars.classBranch, 'examples/applications/', vars.capiClustersNS);
    })
    );

    if (!isTurtlesDevChart && isRancherManagerVersion('>=2.14')) {
      it('Patch the providers chart repository with OCIOptions.downloadAllTags: true', () => {
        // Enabling this option downloads all the chart versions and ensures only supported versions show up
        // Doing so makes updating the chart a smoother process.
        const repositoryName = "turtles-providers-chart";
        const resourceKind = 'clusterrepos.catalog.cattle.io';
        const patch = {spec: {OCIOptions: {'downloadAllTags': true}}};
        cy.patchYamlResource('local', 'default', resourceKind, repositoryName, patch);
        cy.typeInFilter(repositoryName);
        // Make sure the repo is active before leaving
        // Always press Refresh button as workaround for https://github.com/rancher/rancher/issues/49671
        cy.getBySel('sortable-table-0-action-button').click();
        cy.wait(1000);
        cy.get('.icon.group-icon.icon-refresh').parent().click();
        cy.wait(1000);
        cy.contains(new RegExp('Active.*' + repositoryName), {timeout: 150000});
      })
    }

    qase(338, it('Create Providers using Charts', () => {
      const providerSelectionFunction = (text: any) => {
        // @ts-ignore
        text.providers.bootstrapKubeadm.enabled = true;
        // @ts-ignore
        text.providers.bootstrapKubeadm.enableAutomaticUpdate = true;

        // @ts-ignore
        text.providers.controlplaneKubeadm.enabled = true;
        // @ts-ignore
        text.providers.controlplaneKubeadm.enableAutomaticUpdate = true;

        if (isCypressTag('@short') || isCypressTag('@nocaapf') || isCypressTag('@capd') || isCypressTag('@upgrade') || isCypressTag('@switch') || isCypressTag('@use-caapf-switch')) {
            // @ts-ignore
            text.providers.infrastructureDocker.enabled = true;
            // @ts-ignore
            text.providers.infrastructureDocker.enableAutomaticUpdate = true;
          }
        // there is no easy way to only install a specific provider when something like `@capgke` is passed, so we enable all the cloud providers
        if (isCypressTag('@full') || isCypressTag('@nocaapf') || isCypressTag('@capg') || isCypressTag('@capa') || isCypressTag('@capz')) {
            // @ts-ignore
            text.providers.infrastructureGCP.enabled = true;
            // @ts-ignore
            text.providers.infrastructureGCP.enableAutomaticUpdate = true;
            // @ts-ignore
            text.providers.infrastructureGCP.variables.GCP_B64ENCODED_CREDENTIALS = '';

            // @ts-ignore
            text.providers.infrastructureAzure.enabled = true;
            // @ts-ignore
            text.providers.infrastructureAzure.enableAutomaticUpdate = true;

            // @ts-ignore
            text.providers.infrastructureAWS.enabled = true;
            // @ts-ignore
            text.providers.infrastructureAWS.enableAutomaticUpdate = true;
          }

        if (isCypressTag('@vsphere') || isCypressTag('@capv')) {
            // @ts-ignore
            text.providers.infrastructureVSphere.enabled = true;
            // @ts-ignore
            text.providers.infrastructureVSphere.enableAutomaticUpdate = true;
          }
      }

      // Install Rancher Turtles Certified Providers chart
      let operation = isRancherManagerVersion('2.14') && isUpgrade ? 'Upgrade' : 'Install'
      cy.task('suiteLog', `Installing turtles providers chart version ${vars.turtlesProvidersChartVersion}`)
      cy.checkChart('local', operation, vars.turtlesProvidersChartName, turtlesNamespace, {
        version: vars.turtlesProvidersChartVersion,
        modifyYAMLOperation: providerSelectionFunction
      });
    })
    );

    qase(347, it('Wait for all the providers to be Ready', {retries: 2}, () => {
      // Adding this extra check so that retry is not needed in other tests.
      cy.navigateToProviders();
      cy.waitForAllRowsInState('Ready', vars.shortTimeout);
    })
    );

    qase(367, it('Verify Core CAPI Provider', () => {
      cy.navigateToProviders();
      matchAndWaitForProviderReadyStatus(providers.coreCAPIProvider, 'core', providers.coreCAPIProvider, providers.coreCAPIProviderVersion, capiNamespace);
    })
    );

    providerTypes.forEach(providerType => {
      qase([420,421], it('Verify Kubeadm Providers - ' + providerType, () => {
        // Verify CAPI Kubeadm providers
        if (providerType == 'control plane') {
          const namespace = kubeadmProviderNamespaces[1]
          const providerName = providers.kubeadmProvider + '-' + 'control-plane'
          cy.navigateToProviders();
          matchAndWaitForProviderReadyStatus(providerName, 'controlPlane', providers.kubeadmProvider, providers.kubeadmProviderVersion, namespace);
        } else {
          const namespace = kubeadmProviderNamespaces[0]
          const providerName = providers.kubeadmProvider + '-' + providerType
          cy.navigateToProviders()
          matchAndWaitForProviderReadyStatus(providerName, providerType, providers.kubeadmProvider, providers.kubeadmProviderVersion, namespace);
        }
      })
      );

      qase([369,370], it('Verify RKE2 Providers - ' + providerType, () => {
        if (providerType == 'control plane') {
          const namespace = 'rke2-control-plane-system'
          const providerName = providers.rke2Provider + '-' + 'control-plane'
          cy.navigateToProviders();
          matchAndWaitForProviderReadyStatus(providerName, 'controlPlane', providers.rke2Provider, providers.rke2ProviderVersion, namespace);
        } else {
          const namespace = 'rke2-bootstrap-system'
          const providerName = providers.rke2Provider + '-' + providerType
          cy.navigateToProviders();
          matchAndWaitForProviderReadyStatus(providerName, providerType, providers.rke2Provider, providers.rke2ProviderVersion, namespace);
        }
      })
      );
    })
  });

  context('Docker provider', {tags: ['@short', '@short-nocaapf', '@nocaapf', '@capdk', '@capdr', '@upgrade', '@switch', '@use-caapf-switch', '@capdk-nocaapf', '@capdr-nocaapf']}, () => {
    const dockerProviderNamespace = 'capd-system'
    qase(422, it('Verify CAPD provider', () => {
      // Verify Docker Infrastructure provider
      cy.navigateToProviders();
      matchAndWaitForProviderReadyStatus(providers.dockerProvider, 'infrastructure', providers.dockerProvider, providers.kubeadmProviderVersion, dockerProviderNamespace);
    })
    );
  })

  context('vSphere provider', {tags: ['@vsphere', '@vsphere-nocaapf', '@capvk', '@capvk-nocaapf', '@capvr', '@capvr-nocaapf']}, () => {
    const vsphereProviderNamespace = 'capv-system'
    qase(423, it('Verify CAPV provider', () => {
      // Verify vsphere Infrastructure provider
      // See capv_rke2_cluster.spec.ts for more details about `vsphere_secrets_json_base64` structure
      const vsphere_secrets_json_base64 = Cypress.expose("vsphere_secrets_json_base64")
      // Decode the base64 encoded secret and make json object
      const vsphere_secrets_json = JSON.parse(Buffer.from(vsphere_secrets_json_base64, 'base64').toString('utf-8'))
      // Access keys from the json object
      const vsphereUsername = vsphere_secrets_json.vsphere_username;
      const vspherePassword = vsphere_secrets_json.vsphere_password;
      const vsphereServer = vsphere_secrets_json.vsphere_server;
      const vspherePort = '443';
      cy.addCloudCredsVMware(providers.vsphereProvider, vsphereUsername, vspherePassword, vsphereServer, vspherePort);
      cy.burgerMenuOperate('open');
      cy.navigateToProviders();
      matchAndWaitForProviderReadyStatus(providers.vsphereProvider, 'infrastructure', providers.vsphereProvider, providers.vsphereProviderVersion, vsphereProviderNamespace);
    })
    );
  })

  context('Cloud Providers', {tags: ['@full', '@full-nocaapf', '@nocaapf']}, () => {
    const providerType = 'infrastructure'
    qase(424, it('Verify CAPA provider', {tags: ['@capak', '@capar', '@capaeks', '@capar-nocaapf', '@capaeks-nocaapf']},() => {
      const namespace = 'capa-system'
      // Verify AWS Infrastructure provider
      cy.addCloudCredsAWS(providers.amazonProvider, Cypress.expose('aws_access_key'), Cypress.expose('aws_secret_key'));
      cy.burgerMenuOperate('open');
      cy.navigateToProviders();
      matchAndWaitForProviderReadyStatus(providers.amazonProvider, providerType, providers.amazonProvider, providers.amazonProviderVersion, namespace);
    })
    );

    qase(425, it('Verify CAPG provider', {tags: ['@capgk', '@capgke', '@capgk-nocaapf', '@capgke-nocaapf']}, () => {
      const namespace = 'capg-system'
      // Verify GCP Infrastructure provider
      cy.navigateToProviders();

      // Create GCP Cloud Credential until https://github.com/rancher/dashboard/issues/15391 is fixed
      cy.get('tr.main-row').contains('a', providers.googleProvider).closest('tr').within(() => {
        cy.get('td').eq(7).click();      // Action button
      })
      cy.contains('Edit Config').click();
      cy.contains(`Provider: Google - ${providers.googleProvider}`).should('exist');
      cy.typeValue('Credential Name', providers.googleProvider);
      cy.getBySel('text-area-auto-grow').type(Cypress.expose('gcp_credentials'), {log: false});
      cy.clickButton('Continue');
      cy.getBySel('cluster-prov-select-credential').contains(providers.googleProvider).should('be.visible');
      cy.clickButton('Save');
      matchAndWaitForProviderReadyStatus(providers.googleProvider, providerType, providers.googleProvider, providers.googleProviderVersion, namespace);
    })
    );

    context('CAPZ Setup', {tags: ['@capzk', '@capzr', '@capzaks', '@capzk-nocaapf','@capzr-nocaapf', '@capzaks-nocaapf']}, ()=>{
      qase(426,
        it('Verify CAPZ provider', () => {
          const namespace = 'capz-system'
          // Verify Azure Infrastructure provider
          cy.navigateToProviders();
          matchAndWaitForProviderReadyStatus(providers.azureProvider, providerType, providers.azureProvider, providers.azureProviderVersion, namespace);
        })
      );

      qase(345,
        it('Create AzureClusterIdentity', () => {
          const clientID = Cypress.expose("azure_client_id")
          const clientSecret = btoa(Cypress.expose("azure_client_secret"))
          const tenantID = Cypress.expose("azure_tenant_id")

          cy.createAzureClusterIdentity(clientID, tenantID, clientSecret)
        })
      );
    })
  })
});
