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
import { isNewExpression } from 'typescript';

// TODO: Align QASE ID's
Cypress.config();
describe('Enable CAPI Providers', () => {

  const kubeadmProvider = 'kubeadm'
  const dockerProvider = 'docker'
  const amazonProvider = 'aws'
  const googleProvider = 'gcp'
  const kubeadmProviderVersion = 'v1.7.3'
  const kubeadmBaseURL = 'https://github.com/kubernetes-sigs/cluster-api/releases/'
  const kubeadmProviderTypes = ['bootstrap', 'control plane']
  const providerNamespaces = ['capi-kubeadm-bootstrap-system', 'capi-kubeadm-control-plane-system', 'capd-system', 'capa-system', 'capg-system']

  beforeEach(() => {
    cy.login();
    cy.goToHome();
    cypressLib.burgerMenuToggle();
  });

  providerNamespaces.forEach(namespace => {
    it('Create CAPI Providers Namespaces - ' + namespace, () => {
      cy.createNamespace(namespace);
    })
  })

  kubeadmProviderTypes.forEach(providerType => {
    it('Create Kubeadm Providers', () => {
      // TODO: Remove condition after capi-ui-extension/issues/51
      // Create CAPI Kubeadm providers
      if (providerType == 'control plane') {
        const providerURL = kubeadmBaseURL + kubeadmProviderVersion + '/' + 'control-plane' + '-components.yaml'
        const providerName = kubeadmProvider + '-' + 'control-plane'
        const namespace = 'capi-kubeadm-control-plane-system'
        cy.addCustomProvider(providerName, namespace, kubeadmProvider, providerType, kubeadmProviderVersion, providerURL);
      } else {
        const providerURL = kubeadmBaseURL + kubeadmProviderVersion + '/' + providerType + '-components.yaml'
        const providerName = kubeadmProvider + '-' + providerType
        const namespace = 'capi-kubeadm-bootstrap-system'
        cy.addCustomProvider(providerName, namespace, kubeadmProvider, providerType, kubeadmProviderVersion, providerURL);
      }
    })
  })

  qase(4,
    it('Create CAPD provider', () => {
      // Create Docker Infrastructure provider
      cy.addInfraProvider(dockerProvider, dockerProvider, 'capd-system');
      var statusReady = 'Ready'
      statusReady = statusReady.concat(' ', dockerProvider, ' infrastructure ', dockerProvider, ' ', kubeadmProviderVersion)
      cy.contains(statusReady).scrollIntoView();
    })
  );

  qase(13,
    it.skip('Create CAPA provider', () => {
      // Create AWS Infrastructure provider
      cy.addCloudCredsAWS(amazonProvider, Cypress.env('aws_access_key'), Cypress.env('aws_secret_key'));
      cypressLib.burgerMenuToggle();
      cy.addInfraProvider('Amazon', amazonProvider, 'capa-system', amazonProvider);
      var statusReady = 'Ready'
      statusReady = statusReady.concat(' ', amazonProvider, ' infrastructure ', amazonProvider, ' ', 'v2.6.1')
      cy.contains(statusReady).scrollIntoView();
    })
  );

  it.skip('Create CAPG provider', () => {
    // Create AWS Infrastructure provider
    cy.addCloudCredsGCP(googleProvider, Cypress.env('gcp_credentials'));
    cypressLib.burgerMenuToggle();
    cy.addInfraProvider('Google', googleProvider, 'capg-system', googleProvider);
    var statusReady = 'Ready'
    statusReady = statusReady.concat(' ', googleProvider, ' infrastructure ', googleProvider, ' ', 'v1.7.0')
    cy.contains(statusReady).scrollIntoView();
  })

  it.only('Custom Fleet addon config', () => {
    // Allows Fleet addon to be installed on specific clusters only
    // Enables hostNetwork for Fleet addon

    const clusterName = 'local';
    const resourceKind = 'configMap';
    const resourceName = 'fleet-addon-config';
    const namespace = 'rancher-turtles-system';
    //const patch = { 
    //  'data.manifests.spec.cluster.hostNetwork': 'true',
    //  'data.manifests.spec.cluster.selector.matchLabels.fleet-addon-enabled': 'true',
    //  //'data.anewone.spec.cluster.selector.matchLabels.cluster': 'blah',
      //'spec.cluster.hostNetwork': 'true',
    //};
    const patch = {
      data: {
        manifests: {
          isNestedIn: true,
          spec: {
            cluster: {
              hostNetwork: 'true',
              selector: {
                matchLabels: {
                  'fleet-addon-enabled': 'true'
                }
              }
            }
          }
        },
        another_nonexisting_manifests_in_data: {
          isNestedIn: true,
          spec: {
            cluster: {
              selector: {
                matchLabels: {
                  'fleet-addon-enabled': 'true'
                }
              },
              anarray: ['one', 'two', 'three']
            }
          }
        }   
      },
      key: 'value',
      anarray: [ { 'one': 'true' }, 'two', 'three']
    };
    
    cy.patchYamlResource(clusterName, namespace, resourceKind, resourceName, patch);

  });

  it('Check Fleet addon provider', () => {
    // Fleet addon provider is provisioned automatically when enabled during installation
    cy.checkCAPIMenu();
    cy.contains('Providers').click();
    var statusReady = 'Ready'
    // ProviderName is not set for fleet addon hence the empty string, see https://github.com/rancher/turtles/issues/630
    statusReady = statusReady.concat(' ', 'fleet', ' addon ', '', 'v0.3.1')
    cy.contains(statusReady).scrollIntoView();
  })
});
