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
import {qase} from 'cypress-qase-reporter/mocha';
import {isRancherManagerVersion, isTurtlesPrimeBuild, turtlesNamespace} from '~/support/utils';
import {vars} from '~/support/variables';

const buildType = Cypress.env('turtles_dev_chart') ? 'dev' : 'prod';

function matchAndWaitForProviderReadyStatus(
  providerString: string,
  providerType: string,
  providerName: string,
  providerVersion: string,
  timeout: number = 60000,
) {
  const readyState = 'Ready'; // Default state
  cy.reload();
  cy.get('tr.main-row', {timeout: timeout})
    .contains('a', providerString)
    .closest('tr')
    .within(() => {
      cy.get('td').eq(1).should('contain.text', readyState);    // State
      cy.get('td').eq(2).should('contain.text', providerString);  // Name
      cy.get('td').eq(3).should('contain.text', providerType);    // Type
      cy.get('td').eq(4).should('contain.text', providerName);    // ProviderName
      if (isRancherManagerVersion('>=2.13') && isTurtlesPrimeBuild()) {
        cy.get('td').eq(5).should('contain.text', providerVersion); // InstalledVersion
      } else {
        cy.task('log', 'This is not a prime Rancher; skipping provider version check');
      }
      cy.get('td').eq(6).should('contain.text', readyState);      // Phase
    });
}

Cypress.config();
describe('Enable CAPI Providers', () => {
  // Providers names
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
      rke2: 'v0.20.1',
      kubeadm: 'v1.10.6',
      fleet: 'v0.11.0',
      vsphere: 'v1.13.1',
      amazon: 'v2.9.1',
      google: 'v1.10.0',
      azure: 'v1.21.0'
    },
    dev: {
      rke2: 'v0.21.1',
      kubeadm: 'v1.10.6',
      fleet: 'v0.12.0',
      vsphere: 'v1.13.1',
      amazon: 'v2.9.1',
      google: 'v1.10.0',
      azure: 'v1.21.0'
    }
  }

  // Assign the provider versions based on the build type
  const rke2ProviderVersion = providerVersions[buildType].rke2;
  const kubeadmProviderVersion = providerVersions[buildType].kubeadm
  const fleetProviderVersion = providerVersions[buildType].fleet
  const vsphereProviderVersion = providerVersions[buildType].vsphere
  const amazonProviderVersion = providerVersions[buildType].amazon
  const googleProviderVersion = providerVersions[buildType].google
  const azureProviderVersion = providerVersions[buildType].azure

  const kubeadmBaseURL = 'https://github.com/kubernetes-sigs/cluster-api/releases/'
  const kubeProviderTypes = ['bootstrap', 'control plane']
  const capiNamespaces = [vars.capiClustersNS, vars.capiClassesNS]
  const localProviderNamespaces = ['capi-kubeadm-bootstrap-system', 'capi-kubeadm-control-plane-system']

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('Local providers - @install', {tags: '@install'}, () => {
    it('Create CAPI Namespaces', () => {
      cy.createNamespace(capiNamespaces);
    })

    if (isRancherManagerVersion('<2.13')) {
      it('Create Local CAPIProviders Namespaces', () => {
        cy.createNamespace(localProviderNamespaces);
      })
    }

    if (isRancherManagerVersion('>=2.13')) {
      it('Create Providers using Charts', () => {
        const providerSelectionFunction = (text: any) => {
          // @ts-ignore
          text.providers.bootstrapKubeadm.enabled = true;
          // @ts-ignore
          text.providers.controlplaneKubeadm.enabled = true;

          const tags = Cypress.env('grepTags')
          if (tags) {
            if (tags.includes('@short')) {
              // @ts-ignore
              text.providers.infrastructureDocker.enabled = true;
            }
            if (tags.includes('@full')) {
              // @ts-ignore
              text.providers.infrastructureGCP.enabled = true;
              // @ts-ignore
              text.providers.infrastructureGCP.variables.GCP_B64ENCODED_CREDENTIALS = '';

              // @ts-ignore
              text.providers.infrastructureAzure.enabled = true;
              // @ts-ignore
              text.providers.infrastructureAWS.enabled = true;
            }
            if (tags.includes('@vsphere')) {
              // @ts-ignore
              text.providers.infrastructureVSphere.enabled = true;
              // @ts-ignore
              text.providers.infrastructureVSphere.enableAutomaticUpdate = false;
              // @ts-ignore
              text.providers.infrastructureVSphere.version = 'v1.13.1';
            }
          }
        }
        // Install Rancher Turtles Certified Providers chart
        cy.checkChart('local', 'Install', 'Rancher Turtles Certified Providers', turtlesNamespace, undefined, undefined, false, providerSelectionFunction);
      })

      it('Wait for all the providers to be Ready', {retries: 2}, () => {
        // Adding this extra check so that retry is not needed in other tests.
        cy.checkCAPIMenu();
        cy.contains('Providers').click();
        cy.waitForAllRowsInState('Ready', 180000);
      })

    }

    // TODO: Use wizard to create providers, capi-ui-extension/issues/177
    kubeProviderTypes.forEach(providerType => {
      qase(27,
        it('Create/Verify Kubeadm Providers - ' + providerType, () => {
          // Create CAPI Kubeadm providers
          if (providerType == 'control plane') {
            const providerName = kubeadmProvider + '-' + 'control-plane'
            if (isRancherManagerVersion('>=2.13')) {
              cy.checkCAPIMenu();
              cy.contains('Providers').click();
            } else {
              // https://github.com/kubernetes-sigs/cluster-api/releases/v1.10.6/control-plane-components.yaml
              const providerURL = kubeadmBaseURL + kubeadmProviderVersion + '/' + 'control-plane' + '-components.yaml'
              cy.addCustomProvider(providerName, 'capi-kubeadm-control-plane-system', kubeadmProvider, providerType, kubeadmProviderVersion, providerURL);
            }
            matchAndWaitForProviderReadyStatus(providerName, 'controlPlane', kubeadmProvider, kubeadmProviderVersion, 120000);
          } else {
            const providerName = kubeadmProvider + '-' + providerType
            if (isRancherManagerVersion('>=2.13')) {
              cy.checkCAPIMenu();
              cy.contains('Providers').click();
            } else {
              // https://github.com/kubernetes-sigs/cluster-api/releases/v1.10.6/bootstrap-components.yaml
              const providerURL = kubeadmBaseURL + kubeadmProviderVersion + '/' + providerType + '-components.yaml'
              cy.addCustomProvider(providerName, 'capi-kubeadm-bootstrap-system', kubeadmProvider, providerType, kubeadmProviderVersion, providerURL);
            }
            matchAndWaitForProviderReadyStatus(providerName, providerType, kubeadmProvider, kubeadmProviderVersion, 120000);
          }
        })
      );

      it('Create/Verify RKE2 Providers - ' + providerType, () => {
        // Create CAPI Kubeadm providers
        if (providerType == 'control plane') {
          const providerName = rke2Provider + '-' + 'control-plane'
          cy.checkCAPIMenu();
          cy.contains('Providers').click();
          matchAndWaitForProviderReadyStatus(providerName, 'controlPlane', rke2Provider, rke2ProviderVersion, 120000);
        } else {
          const providerName = rke2Provider + '-' + providerType
          cy.checkCAPIMenu();
          cy.contains('Providers').click();
          matchAndWaitForProviderReadyStatus(providerName, providerType, rke2Provider, rke2ProviderVersion, 120000);
        }
      });
    })

    qase(90,
      // HelmApps to be used across all specs
      it('Add Applications fleet repo', () => {
        // Add upstream apps repo
        cy.addFleetGitRepo('helm-apps', vars.turtlesRepoUrl, vars.branch, 'examples/applications/', vars.capiClustersNS);
      })
    );

    xit('Custom Fleet addon config', () => {
      // Skipped as we are unable to install Monitoring app on clusters without cattle-fleet-system namespace
      // Ref. https://github.com/rancher/fleet/issues/3521
      // Allows Fleet addon to be installed on specific clusters only

      const clusterName = 'local';
      const resourceKind = 'configMap';
      const resourceName = 'fleet-addon-config';
      const namespace = turtlesNamespace;
      const patch = {
        data: {
          manifests: {
            isNestedIn: true,
            spec: {cluster: {selector: {matchLabels: {cni: 'by-fleet-addon-kindnet'}}}}
          }
        }
      };

      cy.patchYamlResource(clusterName, namespace, resourceKind, resourceName, patch);
    });

    it('Check Fleet addon provider', () => {
      // Fleet addon provider is provisioned automatically when enabled during installation
      cy.checkCAPIMenu();
      cy.contains('Providers').click();
      matchAndWaitForProviderReadyStatus(fleetProvider, 'addon', fleetProvider, fleetProviderVersion, 30000);
    });
  });

  context('Docker provider', {tags: '@short'}, () => {
    const dockerProviderNamespace = 'capd-system'
    if (isRancherManagerVersion('<2.13')) {
      it('Create CAPIProviders Namespaces', () => {
        cy.createNamespace([dockerProviderNamespace]);
      })
    }

    qase(4,
      it('Create/Verify CAPD provider', () => {
        // Create Docker Infrastructure provider
        if (isRancherManagerVersion('>=2.13')) {
          cy.checkCAPIMenu();
          cy.contains('Providers').click();
        } else {
          cy.addInfraProvider('Docker', dockerProviderNamespace);
        }
        matchAndWaitForProviderReadyStatus(dockerProvider, 'infrastructure', dockerProvider, kubeadmProviderVersion, 120000);
        cy.verifyCAPIProviderImage(dockerProvider, dockerProviderNamespace);
      })
    );
  })

  context('vSphere provider', {tags: '@vsphere'}, () => {
    const vsphereProviderNamespace = 'capv-system'

    if (isRancherManagerVersion('<2.13')) {
      it('Create CAPIProviders Namespaces', () => {
        cy.createNamespace([vsphereProviderNamespace]);
      })
    }
    qase(40,
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
        if (isRancherManagerVersion('>=2.13')) {
          cy.checkCAPIMenu();
          cy.contains('Providers').click();
        } else {
          cy.addInfraProvider('vSphere', vsphereProviderNamespace, vsphereProvider);
        }
        matchAndWaitForProviderReadyStatus(vsphereProvider, 'infrastructure', vsphereProvider, vsphereProviderVersion, 120000);
        cy.verifyCAPIProviderImage(vsphereProvider, vsphereProviderNamespace);
      })
    );
  })

  context('Cloud Providers', {tags: '@full'}, () => {
    const providerType = 'infrastructure'
    if (isRancherManagerVersion('<2.13')) {
      it('Create Cloud CAPIProviders Namespaces', () => {
        const cloudProviderNamespaces = ['capa-system', 'capg-system', 'capz-system']
        cy.createNamespace(cloudProviderNamespaces);
      })
    }

    qase(13,
      it('Create/Verify CAPA provider', () => {
        const namespace = 'capa-system'
        // Create AWS Infrastructure provider
        cy.addCloudCredsAWS(amazonProvider, Cypress.env('aws_access_key'), Cypress.env('aws_secret_key'));
        cy.burgerMenuOperate('open');
        if (isRancherManagerVersion('>=2.13')) {
          cy.checkCAPIMenu();
          cy.contains('Providers').click();
        } else {
          cy.addInfraProvider('Amazon', namespace, amazonProvider);
        }
        matchAndWaitForProviderReadyStatus(amazonProvider, providerType, amazonProvider, amazonProviderVersion, 120000);
        cy.verifyCAPIProviderImage(amazonProvider, namespace);
      })
    );

    qase(28,
      it('Create/Verify CAPG provider', () => {
        const namespace = 'capg-system'
        // Create GCP Infrastructure provider
        if (isRancherManagerVersion('<2.13')) {
          cy.addCloudCredsGCP(googleProvider, Cypress.env('gcp_credentials'));
        }
        cy.burgerMenuOperate('open');
        if (isRancherManagerVersion('>=2.13')) {
          cy.checkCAPIMenu();
          cy.contains('Providers').click();

          // Create GCP Cloud Credential until https://github.com/rancher/dashboard/issues/15391 is fixed
          cy.get('tr.main-row').contains('a', googleProvider).closest('tr').within(() => {
            cy.get('td').eq(7).click();      // Action button
          })
          cy.contains('Edit Config').click();
          cy.contains(`Provider: Google - ${googleProvider}`).should('exist');
          cy.typeValue('Credential Name', googleProvider);
          cy.getBySel('text-area-auto-grow').type(Cypress.env('gcp_credentials'), {log: false});
          cy.clickButton('Continue');
          cy.getBySel('cluster-prov-select-credential').contains(googleProvider).should('be.visible');
          cy.clickButton('Save');
        } else {
          cy.addInfraProvider('Google Cloud Platform', namespace, googleProvider);
        }
        matchAndWaitForProviderReadyStatus(googleProvider, providerType, googleProvider, googleProviderVersion, 120000);
        cy.verifyCAPIProviderImage(googleProvider, namespace);
      })
    );

    qase(20,
      it('Create/Verify CAPZ provider', () => {
        const namespace = 'capz-system'
        // Create Azure Infrastructure provider
        if (isRancherManagerVersion('>=2.13')) {
          cy.checkCAPIMenu();
          cy.contains('Providers').click();
        } else {
          cy.addInfraProvider('Azure', namespace, azureProvider);
        }
        matchAndWaitForProviderReadyStatus(azureProvider, providerType, azureProvider, azureProviderVersion, 180000);
        cy.verifyCAPIProviderImage(azureProvider, namespace);
      })
    );
  })
});
