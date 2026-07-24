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
  isMigration,
  isRancherManagerVersion,
  turtlesNamespace
} from '../support/utils';
import {providers, vars} from '../support/variables';
import {matchAndWaitForProviderReadyStatus} from "../support/commands";

Cypress.config();
describe('Enable CAPI Providers (2.12)', () => {
  const kubeadmBaseURL = 'https://github.com/kubernetes-sigs/cluster-api/releases/'
  const providerTypes = ['bootstrap', 'control plane']
  const capiNamespaces = [vars.capiClustersNS, vars.capiClassesNS]
  const kubeadmProviderNamespaces = ['capi-kubeadm-bootstrap-system', 'capi-kubeadm-control-plane-system']

  before(function () {
    if (isRancherManagerVersion('>2.13') || isMigration) {
      return cy.task('suiteLog', 'Skipping for Rancher version >2.13 or Migration test').then(() => {
        this.skip();
      })
    }
  })
  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('Local providers - @install', {tags: '@install'}, () => {
    qase(492, it('Create CAPI Namespaces', () => {
      cy.createNamespace(capiNamespaces);
    })
    );

    // HelmOps to be used across all specs
    qase(493, it('Add Applications fleet repo', () => {
      // Add upstream apps repo
      cy.addFleetGitRepo('helm-ops', vars.turtlesRepoUrl, vars.classBranch, 'examples/applications/', vars.capiClustersNS);
    })
    );
 
    qase(494, it('Verify Core CAPI Provider', () => {
      cy.navigateToProviders();
      matchAndWaitForProviderReadyStatus(providers.coreCAPIProvider, 'core', providers.coreCAPIProvider, providers.coreCAPIProviderVersion, capiNamespace);
    })
    );

    qase(495, it('Verify Fleet addon provider', () => {
      cy.navigateToProviders();
      matchAndWaitForProviderReadyStatus(providers.fleetProvider, 'addon', providers.fleetProvider, providers.fleetProviderVersion, turtlesNamespace);
    })
    );

    providerTypes.forEach(providerType => {
      qase([496,498], it('Create Kubeadm Providers - ' + providerType, () => {
        // Create CAPI Kubeadm providers
        if (providerType == 'control plane') {
          const namespace = kubeadmProviderNamespaces[1]
          const providerName = providers.kubeadmProvider + '-' + 'control-plane'
          cy.createNamespace([namespace]);
          // https://github.com/kubernetes-sigs/cluster-api/releases/v1.10.6/control-plane-components.yaml
          const providerURL = kubeadmBaseURL + providers.kubeadmProviderVersion + '/' + 'control-plane' + '-components.yaml'
          cy.addCustomProvider(providerName, 'capi-kubeadm-control-plane-system', providers.kubeadmProvider, providerType, providers.kubeadmProviderVersion, providerURL);
          matchAndWaitForProviderReadyStatus(providerName, 'controlPlane', providers.kubeadmProvider, providers.kubeadmProviderVersion, namespace);
        } else {
          const namespace = kubeadmProviderNamespaces[0]
          const providerName = providers.kubeadmProvider + '-' + providerType
          cy.createNamespace([namespace]);
          // https://github.com/kubernetes-sigs/cluster-api/releases/v1.10.6/bootstrap-components.yaml
          const providerURL = kubeadmBaseURL + providers.kubeadmProviderVersion + '/' + providerType + '-components.yaml'
          cy.addCustomProvider(providerName, 'capi-kubeadm-bootstrap-system', providers.kubeadmProvider, providerType, providers.kubeadmProviderVersion, providerURL);
          matchAndWaitForProviderReadyStatus(providerName, providerType, providers.kubeadmProvider, providers.kubeadmProviderVersion, namespace);
        }
      })
      );

      qase([497,499], it('Verify RKE2 Providers - ' + providerType, () => {
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
  })

  context('Docker provider', {tags: ['@short', '@capdk', '@capdr']}, () => {
    const dockerProviderNamespace = 'capd-system'
    qase(500, it('Create Docker CAPIProvider Namespace', () => {
      cy.createNamespace([dockerProviderNamespace]);
    })
    );

    qase(501, it('Create CAPD provider', () => {
      // Create Docker Infrastructure provider
      cy.addInfraProvider('Docker', dockerProviderNamespace);
      matchAndWaitForProviderReadyStatus(providers.dockerProvider, 'infrastructure', providers.dockerProvider, providers.kubeadmProviderVersion, dockerProviderNamespace);
    })
    );
  })

  context('vSphere provider', {tags: ['@vsphere', '@capvk', '@capvr']}, () => {
    const vsphereProviderNamespace = 'capv-system'

    qase(502, it('Create CAPIProviders Namespaces', () => {
      cy.createNamespace([vsphereProviderNamespace]);
    })
    );

    qase(503, it('Create CAPV provider', () => {
      // Create vsphere Infrastructure provider
      // See capv_rke2_cluster.spec.ts for more details about `vsphere_secrets_json_base64` structure
      const vsphere_secrets_json_base64 = Cypress.env("vsphere_secrets_json_base64")
      // Decode the base64 encoded secret and make json object
      const vsphere_secrets_json = JSON.parse(Buffer.from(vsphere_secrets_json_base64, 'base64').toString('utf-8'))
      // Access keys from the json object
      const vsphereUsername = vsphere_secrets_json.vsphere_username;
      const vspherePassword = vsphere_secrets_json.vsphere_password;
      const vsphereServer = vsphere_secrets_json.vsphere_server;
      const vspherePort = '443';
      cy.addCloudCredsVMware(providers.vsphereProvider, vsphereUsername, vspherePassword, vsphereServer, vspherePort);
      cy.burgerMenuOperate('open');
      cy.addInfraProvider('vSphere', vsphereProviderNamespace, providers.vsphereProvider);
      matchAndWaitForProviderReadyStatus(providers.vsphereProvider, 'infrastructure', providers.vsphereProvider, providers.vsphereProviderVersion, vsphereProviderNamespace);
    })
    );
  })

  context('Cloud Providers', {tags: '@full'}, () => {
    const providerType = 'infrastructure'

    qase(505, it('Create CAPA provider', {tags: ['@capak', '@capar', '@capaeks']}, () => {
      const namespace = 'capa-system'
      const providerName = 'aws'
      cy.createCAPIProvider(providerName);
      cy.checkCAPIProvider(providerName);
      matchAndWaitForProviderReadyStatus(providers.amazonProvider, providerType, providers.amazonProvider, providers.amazonProviderVersion, namespace);
    })
    );

    qase(506, it('Create CAPG provider', {tags: ['@capgk', '@capgke']}, () => {
      const namespace = 'capg-system'
      cy.createNamespace([namespace]);
      cy.burgerMenuOperate('open');
      // Create GCP Infrastructure provider
      cy.addCloudCredsGCP(providers.googleProvider, Cypress.expose('gcp_credentials'));
      cy.burgerMenuOperate('open');
      cy.addInfraProvider('Google Cloud Platform', namespace, providers.googleProvider);
      matchAndWaitForProviderReadyStatus(providers.googleProvider, providerType, providers.googleProvider, providers.googleProviderVersion, namespace);
    })
    );

    context('CAPZ Setup', {tags: ['@capzk', '@capzr', '@capzaks']}, ()=>{

      qase(507, it('Create CAPZ provider', () => {
          const namespace = 'capz-system'
          cy.createNamespace([namespace]);
          cy.burgerMenuOperate('open');
          // Create Azure Infrastructure provider
          cy.addInfraProvider('Azure', namespace, providers.azureProvider);
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
