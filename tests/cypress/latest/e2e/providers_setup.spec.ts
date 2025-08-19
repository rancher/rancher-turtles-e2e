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
import {qase} from 'cypress-qase-reporter/dist/mocha';

Cypress.config();
describe('Enable CAPI Providers', () => {
  const statusReady = 'Ready'
  const branch = 'main'
  const turtlesRepoUrl = 'https://github.com/rancher/turtles.git'

  // Providers names
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
      kubeadm: 'v1.9.5',
      fleet: 'v0.11.0',
      vsphere: 'v1.12.0',
      amazon: 'v2.8.1',
      google: 'v1.10.0',
      azure: 'v1.20.1'
    },
    dev: {
      kubeadm: 'v1.9.5',
      fleet: 'v0.11.0',
      vsphere: 'v1.12.0',
      amazon: 'v2.8.1',
      google: 'v1.10.0',
      azure: 'v1.20.1'
    }
  }

  // Set the provider versions based on the environment
  const buildType = Cypress.env('chartmuseum_repo') ? 'dev' : 'prod';

  // Assign the provider versions based on the build type
  const kubeadmProviderVersion = providerVersions[buildType].kubeadm
  const fleetProviderVersion = providerVersions[buildType].fleet
  const vsphereProviderVersion = providerVersions[buildType].vsphere
  const amazonProviderVersion = providerVersions[buildType].amazon
  const googleProviderVersion = providerVersions[buildType].google
  const azureProviderVersion = providerVersions[buildType].azure

  const kubeadmBaseURL = 'https://github.com/kubernetes-sigs/cluster-api/releases/'
  const kubeadmProviderTypes = ['bootstrap', 'control plane']
  const capiNamespaces = ['capi-clusters', 'capi-classes']
  const localProviderNamespaces = ['capi-kubeadm-bootstrap-system', 'capi-kubeadm-control-plane-system', 'capd-system']
  const cloudProviderNamespaces = ['capa-system', 'capg-system', 'capz-system']
  const vsphereProviderNamespace = 'capv-system'

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('Local providers - @install', { tags: '@install' }, () => {
    capiNamespaces.forEach(namespace => {
      it('Create CAPI Namespaces - ' + namespace, () => {
        cy.createNamespace(namespace);
      })
    })

    localProviderNamespaces.forEach(namespace => {
      it('Create CAPI Providers Namespaces - ' + namespace, () => {
        cy.createNamespace(namespace);
      })
    })

    kubeadmProviderTypes.forEach(providerType => {
      qase(27,
        it('Create Kubeadm Providers - ' + providerType, () => {
          // Create CAPI Kubeadm providers
          if (providerType == 'control plane') {
            // https://github.com/kubernetes-sigs/cluster-api/releases/v1.9.5/control-plane-components.yaml
            const providerURL = kubeadmBaseURL + kubeadmProviderVersion + '/' + 'control-plane' + '-components.yaml'
            const providerName = kubeadmProvider + '-' + 'control-plane'
            cy.addCustomProvider(providerName, 'capi-kubeadm-control-plane-system', kubeadmProvider, providerType, kubeadmProviderVersion, providerURL);
            const readyStatus = statusReady.concat(providerName, 'controlPlane', kubeadmProvider, kubeadmProviderVersion)
            cy.contains(readyStatus);
          } else {
            // https://github.com/kubernetes-sigs/cluster-api/releases/v1.9.5/bootstrap-components.yaml
            const providerURL = kubeadmBaseURL + kubeadmProviderVersion + '/' + providerType + '-components.yaml'
            const providerName = kubeadmProvider + '-' + providerType
            cy.addCustomProvider(providerName, 'capi-kubeadm-bootstrap-system', kubeadmProvider, providerType, kubeadmProviderVersion, providerURL);
            const readyStatus = statusReady.concat(providerName, 'bootstrap', kubeadmProvider, kubeadmProviderVersion)
            cy.contains(readyStatus);
          }
        })
      );
    })

    qase(4,
      it('Create CAPD provider', () => {
        // Create Docker Infrastructure provider
        const namespace = 'capd-system'
        cy.addInfraProvider('Docker', dockerProvider, namespace);
        const readyStatus = statusReady.concat(dockerProvider, 'infrastructure', dockerProvider, kubeadmProviderVersion)
        // TODO: add actual vs expected
        cy.contains(readyStatus);
        cy.verifyCAPIProviderImage(dockerProvider, namespace);
      })
    );

    qase(90,
      // HelmApps to be used across all specs
      it('Add Applications fleet repo', () => {
        // Add upstream apps repo
        cy.addFleetGitRepo('helm-apps', turtlesRepoUrl, branch, 'examples/applications/', 'capi-clusters');
      })
    );

    xit('Custom Fleet addon config', () => {
      // Skipped as we are unable to install Monitoring app on clusters without cattle-fleet-system namespace
      // Ref. https://github.com/rancher/fleet/issues/3521
      // Allows Fleet addon to be installed on specific clusters only

      const clusterName = 'local';
      const resourceKind = 'configMap';
      const resourceName = 'fleet-addon-config';
      const namespace = 'rancher-turtles-system';
      const patch = { data: { manifests: { isNestedIn: true, spec: { cluster: { selector: { matchLabels: { cni: 'by-fleet-addon-kindnet' } } } } } } };

      cy.patchYamlResource(clusterName, namespace, resourceKind, resourceName, patch);
    });

    it('Check Fleet addon provider', () => {
      // Fleet addon provider is provisioned automatically when enabled during installation
      cy.checkCAPIMenu();
      cy.contains('Providers').click();
      const readyStatus = statusReady.concat(fleetProvider, 'addon', fleetProvider, fleetProviderVersion);
      cy.contains(readyStatus).scrollIntoView();
    });
  });

  context('vSphere provider', { tags: '@vsphere' }, () => {
    it('Create CAPI Providers Namespace - ' + vsphereProviderNamespace, () => {
      cy.createNamespace(vsphereProviderNamespace);
    })
    qase(40,
      it('Create CAPV provider', () => {
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
        cy.addInfraProvider('vsphere', vsphereProvider, vsphereProviderNamespace, vsphereProvider);
        const readyStatus = statusReady.concat(vsphereProvider, 'infrastructure', vsphereProvider, vsphereProviderVersion)
        cy.contains(readyStatus);
        cy.verifyCAPIProviderImage(vsphereProvider, vsphereProviderNamespace);
      })
    );
  })

  context('Cloud Providers', { tags: '@full' }, () => {
    const providerType = 'infrastructure'
    cloudProviderNamespaces.forEach(namespace => {
      it('Create CAPI Cloud Providers Namespaces - ' + namespace, () => {
        cy.createNamespace(namespace);
      })
    })

    qase(13,
      it('Create CAPA provider', () => {
        const namespace = 'capa-system'
        // Create AWS Infrastructure provider
        cy.addCloudCredsAWS(amazonProvider, Cypress.env('aws_access_key'), Cypress.env('aws_secret_key'));
        cy.burgerMenuOperate('open');
        cy.addInfraProvider('Amazon', amazonProvider, namespace, amazonProvider);
        const readyStatus = statusReady.concat(amazonProvider, providerType, amazonProvider, amazonProviderVersion)
        cy.contains(readyStatus);
        cy.verifyCAPIProviderImage(amazonProvider, namespace);
      })
    );

    qase(28,
      it('Create CAPG provider', () => {
        const namespace = 'capg-system'
        // Create GCP Infrastructure provider
        cy.addCloudCredsGCP(googleProvider, Cypress.env('gcp_credentials'));
        cy.burgerMenuOperate('open');
        cy.addInfraProvider('Google', googleProvider, namespace, googleProvider);
        const readyStatus = statusReady.concat(googleProvider, providerType, googleProvider, googleProviderVersion)
        cy.contains(readyStatus, { timeout: 120000 });
        cy.verifyCAPIProviderImage(googleProvider, namespace);
      })
    );

    qase(20, it('Create CAPZ provider', () => {
      const namespace = 'capz-system'
      // Create Azure Infrastructure provider
      cy.addCloudCredsAzure(azureProvider, Cypress.env('azure_client_id'), Cypress.env('azure_client_secret'), Cypress.env('azure_subscription_id'));
      cy.burgerMenuOperate('open');
      cy.addInfraProvider('Azure', azureProvider, namespace, azureProvider);
      const readyStatus = statusReady.concat(azureProvider, providerType, azureProvider, azureProviderVersion)
      cy.contains(readyStatus, { timeout: 180000 });
      cy.verifyCAPIProviderImage(azureProvider, namespace);
    })
    );
  })

});
