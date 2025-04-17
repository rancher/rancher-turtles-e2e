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
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';

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
  const kubeadmProviderVersion = 'v1.9.5'
  const fleetProviderVersion = 'v0.7.4'
  const vsphereProviderVersion = 'v1.12.0'
  const amazonProviderVersion = 'v2.8.1'
  const googleProviderVersion = 'v1.9.0'
  const azureProviderVersion = 'v1.19.1'

  const kubeadmBaseURL = 'https://github.com/kubernetes-sigs/cluster-api/releases/'
  const kubeadmProviderTypes = ['bootstrap', 'control plane']
  const localProviderNamespaces = ['capi-kubeadm-bootstrap-system', 'capi-kubeadm-control-plane-system', 'capd-system']
  const cloudProviderNamespaces = ['capa-system', 'capg-system', 'capz-system']
  const vsphereProviderNamespace = 'capv-system'

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  context('Local providers - @install', { tags: '@install' }, () => {
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
            const readyStatus  = statusReady.concat(providerName, 'bootstrap', kubeadmProvider, kubeadmProviderVersion)
            cy.contains(readyStatus);
          }
        })
      );
    })

    qase(4,
      it('Create CAPD provider', () => {
        // Create Docker Infrastructure provider
        cy.addInfraProvider('Docker', dockerProvider, 'capd-system');
        const readyStatus  = statusReady.concat(dockerProvider, 'infrastructure', dockerProvider, kubeadmProviderVersion)
        // TODO: add actual vs expected
        cy.contains(readyStatus);
      })
    );

    it('Add Docker Clusterclass fleet repo', () => {
      // Add upstream docker classes repo to fleet-local workspace
      cy.addFleetGitRepo('docker-clusterclasses', turtlesRepoUrl, branch, 'examples/clusterclasses/docker');
    });

    // CNI to be used across all specs
    it('Add CNI fleet repo', () => {
      // Add upstream cni repo to fleet-local workspace
      cy.addFleetGitRepo('cni-calico', turtlesRepoUrl, branch, 'examples/applications/cni/calico');
    });

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
      const readyStatus  = statusReady.concat(fleetProvider, 'addon', fleetProvider, fleetProviderVersion);
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
        cypressLib.burgerMenuToggle();
        cy.addInfraProvider('vsphere', vsphereProvider, vsphereProviderNamespace, vsphereProvider);
        const readyStatus  = statusReady.concat(vsphereProvider, 'infrastructure', vsphereProvider, vsphereProviderVersion)
        cy.contains(readyStatus);
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
        // Create AWS Infrastructure provider
        cy.addCloudCredsAWS(amazonProvider, Cypress.env('aws_access_key'), Cypress.env('aws_secret_key'));
        cypressLib.burgerMenuToggle();
        cy.addInfraProvider('Amazon', amazonProvider, 'capa-system', amazonProvider);
        const readyStatus  = statusReady.concat(amazonProvider, providerType, amazonProvider, amazonProviderVersion)
        cy.contains(readyStatus);
      })
    );

    qase(28,
      it('Create CAPG provider', () => {
        // Create GCP Infrastructure provider
        cy.addCloudCredsGCP(googleProvider, Cypress.env('gcp_credentials'));
        cypressLib.burgerMenuToggle();
        cy.addInfraProvider('Google', googleProvider, 'capg-system', googleProvider);
        const readyStatus  = statusReady.concat(googleProvider, providerType, googleProvider, googleProviderVersion)
        cy.contains(readyStatus, { timeout: 120000 });
      })
    );

    qase(20, it('Create CAPZ provider', () => {
      // Create Azure Infrastructure provider
      cy.addCloudCredsAzure(azureProvider, Cypress.env('azure_client_id'), Cypress.env('azure_client_secret'), Cypress.env('azure_subscription_id'));
      cypressLib.burgerMenuToggle();
      cy.addInfraProvider('Azure', azureProvider, 'capz-system', azureProvider);
      const readyStatus  = statusReady.concat(azureProvider, providerType, azureProvider, azureProviderVersion)
      cy.contains(readyStatus, { timeout: 180000 });
    })
    );
  })

});
