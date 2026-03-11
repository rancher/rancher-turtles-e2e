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

import '~/support/commands';
import {
  capiNamespace,
  isMigration,
  isRancherManagerVersion,
  isTurtlesDevChart,
  turtlesNamespace
} from '~/support/utils';
import {vars} from '~/support/variables';
import {matchAndWaitForProviderReadyStatus} from "~/support/commands";

const buildType = isTurtlesDevChart && isRancherManagerVersion('2.12') ? 'dev-v2.12' : 'prod';

Cypress.config();
describe('Enable CAPI Providers', () => {
  // Providers names
  const coreCAPIProvider = 'cluster-api'
  const rke2Provider = 'rke2'
  const kubeadmProvider = 'kubeadm'
  const dockerProvider = 'docker'
  const amazonProvider = 'aws'
  const googleProvider = 'gcp'
  const azureProvider = 'azure'
  const fleetProvider = 'fleet'
  const vsphereProvider = 'vsphere'

  // Expected provider versions
  const providerVersions = {
    prod: {
      capi: 'v1.10.5',
      rke2: 'v0.20.1',
      kubeadm: 'v1.10.5',
      fleet: 'v0.11.0',
      vsphere: 'v1.13.1',
      amazon: 'v2.9.1',
      google: 'v1.10.0',
      azure: 'v1.21.0'
    },
    'dev-v2.12': {
      capi: 'v1.10.5',
      rke2: 'v0.20.1',
      kubeadm: 'v1.10.5',
      fleet: 'v0.11.0',
      vsphere: 'v1.13.1',
      amazon: 'v2.9.1',
      google: 'v1.10.0',
      azure: 'v1.21.0'
    }
  }

  // Assign the provider versions based on the chart type
  const coreCAPIProviderVersion = providerVersions[buildType].capi;
  const rke2ProviderVersion = providerVersions[buildType].rke2;
  const kubeadmProviderVersion = providerVersions[buildType].kubeadm
  const fleetProviderVersion = providerVersions[buildType].fleet
  const vsphereProviderVersion = providerVersions[buildType].vsphere
  const amazonProviderVersion = providerVersions[buildType].amazon
  const googleProviderVersion = providerVersions[buildType].google
  const azureProviderVersion = providerVersions[buildType].azure

  const kubeadmBaseURL = 'https://github.com/kubernetes-sigs/cluster-api/releases/'
  const providerTypes = ['bootstrap', 'control plane']
  const capiNamespaces = [vars.capiClustersNS, vars.capiClassesNS]
  const kubeadmProviderNamespaces = ['capi-kubeadm-bootstrap-system', 'capi-kubeadm-control-plane-system']

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  if (isRancherManagerVersion('2.12') && !isMigration) {
    context('Local providers - @install', {tags: '@install'}, () => {
      it('Create CAPI Namespaces', () => {
        cy.createNamespace(capiNamespaces);
      })

      // HelmOps to be used across all specs
      it('Add Applications fleet repo', () => {
        // Add upstream apps repo
        cy.addFleetGitRepo('helm-ops', vars.turtlesRepoUrl, vars.classBranch, 'examples/applications/', vars.capiClustersNS);
      })
 
      it('Verify Core CAPI Provider', () => {
        cy.checkCAPIMenu();
        cy.contains('Providers').click();
        matchAndWaitForProviderReadyStatus(coreCAPIProvider, 'core', coreCAPIProvider, coreCAPIProviderVersion, capiNamespace);
      });

      it('Verify Fleet addon provider', () => {
        cy.checkCAPIMenu();
        cy.contains('Providers').click();
        matchAndWaitForProviderReadyStatus(fleetProvider, 'addon', fleetProvider, fleetProviderVersion, turtlesNamespace);
      });

      providerTypes.forEach(providerType => {
        it('Create Kubeadm Providers - ' + providerType, () => {
          // Create CAPI Kubeadm providers
          if (providerType == 'control plane') {
            const namespace = kubeadmProviderNamespaces[1]
            const providerName = kubeadmProvider + '-' + 'control-plane'
            cy.createNamespace([namespace]);
            // https://github.com/kubernetes-sigs/cluster-api/releases/v1.10.6/control-plane-components.yaml
            const providerURL = kubeadmBaseURL + kubeadmProviderVersion + '/' + 'control-plane' + '-components.yaml'
            cy.addCustomProvider(providerName, 'capi-kubeadm-control-plane-system', kubeadmProvider, providerType, kubeadmProviderVersion, providerURL);
            matchAndWaitForProviderReadyStatus(providerName, 'controlPlane', kubeadmProvider, kubeadmProviderVersion, namespace);
          } else {
            const namespace = kubeadmProviderNamespaces[0]
            const providerName = kubeadmProvider + '-' + providerType
            cy.createNamespace([namespace]);
            // https://github.com/kubernetes-sigs/cluster-api/releases/v1.10.6/bootstrap-components.yaml
            const providerURL = kubeadmBaseURL + kubeadmProviderVersion + '/' + providerType + '-components.yaml'
            cy.addCustomProvider(providerName, 'capi-kubeadm-bootstrap-system', kubeadmProvider, providerType, kubeadmProviderVersion, providerURL);
            matchAndWaitForProviderReadyStatus(providerName, providerType, kubeadmProvider, kubeadmProviderVersion, namespace);
          }
        })

        it('Verify RKE2 Providers - ' + providerType, () => {
          if (providerType == 'control plane') {
            const namespace = 'rke2-control-plane-system'
            const providerName = rke2Provider + '-' + 'control-plane'
            cy.checkCAPIMenu();
            cy.contains('Providers').click();
            matchAndWaitForProviderReadyStatus(providerName, 'controlPlane', rke2Provider, rke2ProviderVersion, namespace);
          } else {
            const namespace = 'rke2-bootstrap-system'
            const providerName = rke2Provider + '-' + providerType
            cy.checkCAPIMenu();
            cy.contains('Providers').click();
            matchAndWaitForProviderReadyStatus(providerName, providerType, rke2Provider, rke2ProviderVersion, namespace);
          }
        });
      })
    })

    context('Docker provider', {tags: '@short'}, () => {
      const dockerProviderNamespace = 'capd-system'
      it('Create Docker CAPIProvider Namespace', () => {
        cy.createNamespace([dockerProviderNamespace]);
      })

      it('Create CAPD provider', () => {
        // Create Docker Infrastructure provider
        cy.addInfraProvider('Docker', dockerProviderNamespace);
        matchAndWaitForProviderReadyStatus(dockerProvider, 'infrastructure', dockerProvider, kubeadmProviderVersion, dockerProviderNamespace);
      })
    })

    context('vSphere provider', {tags: '@vsphere'}, () => {
      const vsphereProviderNamespace = 'capv-system'

      it('Create CAPIProviders Namespaces', () => {
        cy.createNamespace([vsphereProviderNamespace]);
      })
      it('Create/Verify CAPV provider', () => {
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
        cy.addCloudCredsVMware(vsphereProvider, vsphereUsername, vspherePassword, vsphereServer, vspherePort);
        cy.burgerMenuOperate('open');
        cy.addInfraProvider('vSphere', vsphereProviderNamespace, vsphereProvider);
        matchAndWaitForProviderReadyStatus(vsphereProvider, 'infrastructure', vsphereProvider, vsphereProviderVersion, vsphereProviderNamespace);
      })
    })

    context('Cloud Providers', {tags: '@full'}, () => {
      const providerType = 'infrastructure'
      it('Create Cloud CAPIProviders Namespaces', () => {
        const cloudProviderNamespaces = ['capa-system', 'capg-system', 'capz-system']
        cy.createNamespace(cloudProviderNamespaces);
      })

      it('Create/Verify CAPA provider', () => {
        const namespace = 'capa-system'
        // Create AWS Infrastructure provider
        cy.addCloudCredsAWS(amazonProvider, Cypress.env('aws_access_key'), Cypress.env('aws_secret_key'));
        cy.burgerMenuOperate('open');
        cy.addInfraProvider('Amazon', namespace, amazonProvider);
        matchAndWaitForProviderReadyStatus(amazonProvider, providerType, amazonProvider, amazonProviderVersion, namespace);
      })

      it('Create CAPG provider', () => {
        const namespace = 'capg-system'
        // Create GCP Infrastructure provider
        cy.addCloudCredsGCP(googleProvider, Cypress.env('gcp_credentials'));
        cy.burgerMenuOperate('open');
        cy.addInfraProvider('Google Cloud Platform', namespace, googleProvider);
        matchAndWaitForProviderReadyStatus(googleProvider, providerType, googleProvider, googleProviderVersion, namespace);
      })

      it('Create CAPZ provider', () => {
        const namespace = 'capz-system'
        // Create Azure Infrastructure provider
        cy.addInfraProvider('Azure', namespace, azureProvider);
        matchAndWaitForProviderReadyStatus(azureProvider, providerType, azureProvider, azureProviderVersion, namespace);
      })
    })
  }
});
