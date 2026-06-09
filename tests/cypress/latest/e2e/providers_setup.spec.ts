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
  isRancherManagerVersion,
  isTurtlesDevChart,
  isUpgrade,
  isUseCAAPFSupported,
  providersChartNeedsStgRegistry,
  turtlesNamespace,
} from '../support/utils';
import {vars} from '../support/variables';
import {matchAndWaitForProviderReadyStatus} from "../support/commands";

type BuildType = 'prod-v2.13' | 'prod-v2.14' | 'prod-v2.15' | 'dev-v2.13' | 'dev-v2.14' | 'dev-v2.15';
const buildType = determineBuildType();

function determineBuildType(): BuildType {
  if (isTurtlesDevChart && isRancherManagerVersion('2.13')) {
    return 'dev-v2.13';
  }
  if (isTurtlesDevChart && isRancherManagerVersion('2.14')) {
    return 'dev-v2.14';
  }
  if (isTurtlesDevChart && isRancherManagerVersion('2.15')) {
    return 'dev-v2.15';
  }
  if (isRancherManagerVersion('2.13')) {
    return 'prod-v2.13';
  }
  if (isRancherManagerVersion('2.14')) {
    return 'prod-v2.14';
  }
  if (isRancherManagerVersion('2.15')) {
    return 'prod-v2.15';
  }
  return undefined as unknown as BuildType; // This should never happen, but it satisfies the type checker
}

if (isRancherManagerVersion('>2.12')) {
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
    'prod-v2.13': {
      capi: 'v1.10.6',
      rke2: 'v0.21.1',
      kubeadm: 'v1.10.6',
      fleet: 'v0.12.0',
      vsphere: 'v1.13.1',
      amazon: 'v2.9.1',
      google: 'v1.10.0',
      azure: 'v1.21.0'
    },
    'prod-v2.14': {
      capi: 'v1.12.7',
      rke2: 'v0.24.4',
      kubeadm: 'v1.12.7',
      fleet: 'v0.14.1',
      vsphere: 'v1.15.2',
      amazon: 'v2.11.1',
      google: 'v1.11.1',
      azure: 'v1.22.0'
    },
    'prod-v2.15': {
      capi: 'v1.13.2',
      rke2: 'v0.25.0',
      kubeadm: 'v1.13.2',
      fleet: 'v0.15.0',
      vsphere: 'v1.16.1',
      amazon: 'v2.11.1',
      google: 'v1.11.2',
      azure: 'v1.23.2'
    },
    'dev-v2.13': {
      capi: 'v1.10.6',
      rke2: 'v0.21.1',
      kubeadm: 'v1.10.6',
      fleet: 'v0.12.0',
      vsphere: 'v1.13.1',
      amazon: 'v2.9.1',
      google: 'v1.10.0',
      azure: 'v1.21.0'
    },
    'dev-v2.14': {
      capi: 'v1.12.7',
      rke2: 'v0.24.4',
      kubeadm: 'v1.12.7',
      fleet: 'v0.14.1',
      vsphere: 'v1.15.2',
      amazon: 'v2.11.1',
      google: 'v1.11.1',
      azure: 'v1.22.0'
    },
    'dev-v2.15': {
      capi: 'v1.13.2',
      rke2: 'v0.25.0',
      kubeadm: 'v1.13.2',
      fleet: 'v0.15.0',
      vsphere: 'v1.16.1',
      amazon: 'v2.11.1',
      google: 'v1.11.2',
      azure: 'v1.23.2'
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

  const providerTypes = ['bootstrap', 'control plane']
  const kubeadmProviderNamespaces = ['capi-kubeadm-bootstrap-system', 'capi-kubeadm-control-plane-system']

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

    // This feature gate needs to be enabled for >=2.14.1
    // This feature is set to true(in pre_upgrade_setup.spec.ts) before the rancher upgrade; that's why we skip this step for upgrade test.
    if (isUseCAAPFSupported && !isUpgrade) {
      qase(436, it('Enable turtles feature gate: use-caapf', () => {
        const enableFeatureGate = (text: any) => {
          // to disable the feature flag, simply removing this data won't be enough. The value must be reset to "false".
          text.data["rancher-turtles"] = `{"features": {"use-caapf": {"enabled": "true"}}}`;
        }
        cy.editKubernetesResource({
          name: "rancher-config",
          clusterName: "local",
          resourcePath: ["More Resources", "Core", "ConfigMaps"],
          namespace: "cattle-system",
          modifyYAMLOperation: enableFeatureGate
        });

        // Ensure the turtles deployment has the feature gate enabled
        cy.setNamespace(turtlesNamespace)
        cy.clickNavMenu(["Workloads", "Deployments"]);
        cy.typeInFilter('rancher-turtles-controller-manager');
        // We need to explicitly wait for the turtles controller deployment to restart
        cy.getBySel('sortable-cell-0-0').contains('In Progress', {timeout: 60000});
        cy.getBySel('sortable-cell-0-0').contains('Active', {timeout: 30000});
        cy.getBySel('sortable-table-0-action-button').click();
        cy.get('div.dropdownTarget').contains('Show Configuration').click();
        cy.getBySel('btn-yaml-tab').click();
        cy.get('.CodeMirror-code').contains("use-caapf=true");
        cy.clickButton('Close');
        cy.namespaceReset();
      })
      );
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

        // fleet-addon needs to be explicitly enabled for >=2.14.1.
        // @ts-ignore
        text.providers.addonFleet.enabled = true;

        if (isCypressTag('@short') || isCypressTag('@capd') || isCypressTag('@upgrade') || isCypressTag('@switch')) {
            // @ts-ignore
            text.providers.infrastructureDocker.enabled = true;
            // @ts-ignore
            text.providers.infrastructureDocker.enableAutomaticUpdate = true;
          }
        // there is no easy way to only install a specific provider when something like `@capgke` is passed, so we enable all the cloud providers
        if (isCypressTag('@full') || isCypressTag('@capg') || isCypressTag('@capa') || isCypressTag('@capz')) {
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
      let turtlesProvidersChartVersion = providersChartNeedsStgRegistry() && isRancherManagerVersion('2.13') ? '0.25' : providersChartNeedsStgRegistry() && isRancherManagerVersion('2.14') ? '0.26' : undefined
      cy.checkChart('local', operation, vars.turtlesProvidersChartName, turtlesNamespace, {
        version: turtlesProvidersChartVersion,
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
      matchAndWaitForProviderReadyStatus(coreCAPIProvider, 'core', coreCAPIProvider, coreCAPIProviderVersion, capiNamespace);
    })
    );

    qase(368, it('Verify Fleet addon provider', () => {
      cy.navigateToProviders();
      matchAndWaitForProviderReadyStatus(fleetProvider, 'addon', fleetProvider, fleetProviderVersion, 'fleet-addon-system');
    })
    );

    providerTypes.forEach(providerType => {
      qase([420,421], it('Verify Kubeadm Providers - ' + providerType, () => {
        // Verify CAPI Kubeadm providers
        if (providerType == 'control plane') {
          const namespace = kubeadmProviderNamespaces[1]
          const providerName = kubeadmProvider + '-' + 'control-plane'
          cy.navigateToProviders();
          matchAndWaitForProviderReadyStatus(providerName, 'controlPlane', kubeadmProvider, kubeadmProviderVersion, namespace);
        } else {
          const namespace = kubeadmProviderNamespaces[0]
          const providerName = kubeadmProvider + '-' + providerType
          cy.navigateToProviders()
          matchAndWaitForProviderReadyStatus(providerName, providerType, kubeadmProvider, kubeadmProviderVersion, namespace);
        }
      })
      );

      qase([369,370], it('Verify RKE2 Providers - ' + providerType, () => {
        if (providerType == 'control plane') {
          const namespace = 'rke2-control-plane-system'
          const providerName = rke2Provider + '-' + 'control-plane'
          cy.navigateToProviders();
          matchAndWaitForProviderReadyStatus(providerName, 'controlPlane', rke2Provider, rke2ProviderVersion, namespace);
        } else {
          const namespace = 'rke2-bootstrap-system'
          const providerName = rke2Provider + '-' + providerType
          cy.navigateToProviders();
          matchAndWaitForProviderReadyStatus(providerName, providerType, rke2Provider, rke2ProviderVersion, namespace);
        }
      })
      );
    })
  });

  context('Docker provider', {tags: ['@short', '@capdk', '@capdr', '@upgrade', '@switch']}, () => {
    const dockerProviderNamespace = 'capd-system'
    qase(422, it('Verify CAPD provider', () => {
      // Verify Docker Infrastructure provider
      cy.navigateToProviders();
      matchAndWaitForProviderReadyStatus(dockerProvider, 'infrastructure', dockerProvider, kubeadmProviderVersion, dockerProviderNamespace);
    })
    );
  })

  context('vSphere provider', {tags: ['@vsphere', '@capvk', '@capvr']}, () => {
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
      cy.addCloudCredsVMware(vsphereProvider, vsphereUsername, vspherePassword, vsphereServer, vspherePort);
      cy.burgerMenuOperate('open');
      cy.navigateToProviders();
      matchAndWaitForProviderReadyStatus(vsphereProvider, 'infrastructure', vsphereProvider, vsphereProviderVersion, vsphereProviderNamespace);
    })
    );
  })

  context('Cloud Providers', {tags: '@full'}, () => {
    const providerType = 'infrastructure'
    qase(424, it('Verify CAPA provider', {tags: ['@capak', '@capar', '@capaeks']},() => {
      const namespace = 'capa-system'
      // Verify AWS Infrastructure provider
      cy.addCloudCredsAWS(amazonProvider, Cypress.expose('aws_access_key'), Cypress.expose('aws_secret_key'));
      cy.burgerMenuOperate('open');
      cy.navigateToProviders();
      matchAndWaitForProviderReadyStatus(amazonProvider, providerType, amazonProvider, amazonProviderVersion, namespace);
    })
    );

    qase(425, it('Verify CAPG provider', {tags: ['@capgk', '@capgke']}, () => {
      const namespace = 'capg-system'
      // Verify GCP Infrastructure provider
      cy.navigateToProviders();

      // Create GCP Cloud Credential until https://github.com/rancher/dashboard/issues/15391 is fixed
      cy.get('tr.main-row').contains('a', googleProvider).closest('tr').within(() => {
        cy.get('td').eq(7).click();      // Action button
      })
      cy.contains('Edit Config').click();
      cy.contains(`Provider: Google - ${googleProvider}`).should('exist');
      cy.typeValue('Credential Name', googleProvider);
      cy.getBySel('text-area-auto-grow').type(Cypress.expose('gcp_credentials'), {log: false});
      cy.clickButton('Continue');
      cy.getBySel('cluster-prov-select-credential').contains(googleProvider).should('be.visible');
      cy.clickButton('Save');
      matchAndWaitForProviderReadyStatus(googleProvider, providerType, googleProvider, googleProviderVersion, namespace);
    })
    );

    qase(426, it('Verify CAPZ provider', {tags: ['@capzk', '@capzr', '@capzaks']}, () => {
      const namespace = 'capz-system'
      // Verify Azure Infrastructure provider
      cy.navigateToProviders();
      matchAndWaitForProviderReadyStatus(azureProvider, providerType, azureProvider, azureProviderVersion, namespace);
    })
    );
  })
});
}
