import '../support/commands';
import {
  capiNamespace,
  getClusterName,
  isRancherManagerVersion,
  isTurtlesDevChart,
  turtlesNamespace
} from '../support/utils';
import {capdResourcesCleanup, capiClusterDeletion} from '../support/cleanup_support';
import {vars} from '../support/variables';

Cypress.config();
describe('Switch CAPI Feature Flags (2.13)', {tags: '@switch'}, () => {
  const capiProvisioningNamespace = 'cattle-provisioning-capi-system';
  const turtlesHelmApp = 'rancher-turtles'
  const capiProvisioningHelmApp = 'rancher-provisioning-capi'
  const coreCAPICM = 'core-cluster-api-v1.10.6'
  const timeout = vars.shortTimeout;
  const classNamePrefix = 'docker-rke2';
  const clusterName = getClusterName(classNamePrefix);
  const classesPath = 'examples/clusterclasses/docker/rke2';
  const clusterClassRepoName = 'docker-rke2-clusterclass';
  const classClusterFileName = './fixtures/docker/capd-rke2-class-cluster-v1beta1.yaml';
  const dockerAuthUsernameBase64 = btoa(Cypress.expose('docker_auth_username'));
  const dockerAuthPasswordBase64 = btoa(Cypress.expose('docker_auth_password'));

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  if (isRancherManagerVersion('2.13')) {

    context('[SETUP]', () => {
      qase(461, it('Verify rancher-turtles exists and rancher-provisioning-capi does not', () => {
        cy.checkKubernetesResource('local', ['Apps', 'Installed Apps'], turtlesHelmApp, true, turtlesNamespace);
        cy.checkKubernetesResource('local', ['Apps', 'Installed Apps'], capiProvisioningHelmApp, false, capiProvisioningNamespace);
      })
      );

      qase(462, it('Verify capi-controller-manager deployment exists', () => {
        cy.checkKubernetesResource('local', ['Workloads', 'Deployments'], 'capi-controller-manager', true, capiNamespace);
      })
      );

      qase(463, it('Import ClusterctlConfig', () => {
        cy.importYAML('./fixtures/switch/clusterctlconfig.yaml');
      })
      );

    });

    context('[CLUSTER-IMPORT]', () => {
      qase(464, it('Setup the namespace for importing', () => {
        cy.namespaceAutoImport('Disable');
      })
      );

      qase(465, it('Create Docker Auth Secret', () => {
        cy.readFile('./fixtures/docker/capd-auth-token-secret.yaml').then((data) => {
          data = data.replace(/replace_cluster_docker_auth_username/, dockerAuthUsernameBase64);
          data = data.replace(/replace_cluster_docker_auth_password/, dockerAuthPasswordBase64);
          cy.importYAML(data, vars.capiClustersNS);
        });
      })
      );

      qase(466, it('Add CAPD RKE2 ClusterClass Fleet Repo', () => {
        cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS);
        cy.checkCAPIClusterClass(classNamePrefix);
      })
      );

      qase(467, it('Import CAPD RKE2 class-cluster using YAML', () => {
        cy.readFile(classClusterFileName).then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName);
          data = data.replace(/replace_rke2_version/g, vars.rke2Version);
          data = data.replace(/replace_kind_version/g, vars.kindVersion);
          cy.importYAML(data, vars.capiClustersNS);
        });
        cy.checkCAPICluster(clusterName);
      })
      );

      qase(468, it('Auto import child CAPD cluster', () => {
        cy.checkCAPIClusterProvisioned(clusterName, timeout);
        cy.goToHome();
        cy.contains(clusterName).should('exist');
        cy.searchCluster(clusterName);
        cy.contains(new RegExp('Active.*' + clusterName), {timeout: timeout});
        cy.checkCAPIClusterActive(clusterName, timeout);
      })
      );

    });

    context('[SWITCH-TO-CAPI-PROVISIONING]', () => {
      qase(469, it('Uninstall Rancher Turtles Providers chart', () => {
        // Uninstall Rancher Turtles Providers chart
        cy.deleteKubernetesResource('local', ['Apps', 'Installed Apps'], vars.turtlesProvidersHelmApp, turtlesNamespace);
      })
      );

      qase(470, it('Enable embedded-cluster-api and disable turtles', () => {
        cy.setCAPIFeature('embedded-cluster-api', 'true');
        cy.setCAPIFeature('turtles', 'false');
      })
      );

      qase(471, it('Verify rancher-provisioning-capi exists and rancher-turtles does not', {retries: 2}, () => {
        cy.checkKubernetesResource('local', ['Apps', 'Installed Apps'], capiProvisioningHelmApp, true, capiProvisioningNamespace, timeout);
        cy.checkKubernetesResource('local', ['Apps', 'Installed Apps'], turtlesHelmApp, false, turtlesNamespace);
      })
      );

      qase(472, it('Verify ClusterctlConfig does not exist', () => {
        // This resource will not be found since it was deployed in turtlesNamespace which gets deleted on uninstalling turtles chart
        cy.checkKubernetesResource('local', ['More Resources', 'turtles-capi.cattle.io'], 'clusterctl-config', false, turtlesNamespace);
      })
      );

      qase(473, it('Verify core-cluster-api ConfigMap does not exist', () => {
        cy.checkKubernetesResource('local', ['More Resources', 'Core', 'ConfigMaps'], coreCAPICM, false, capiNamespace);
      })
      );

      qase(474, it('Verify CAPD cluster is still active', () => {
        cy.goToHome();
        cy.contains(clusterName).should('exist');
        cy.searchCluster(clusterName);
        cy.contains(new RegExp('Active.*' + clusterName));
      })
      );
    });

    context('[SWITCH-TO-TURTLES]', () => {
      qase(475, it('Disable embedded-cluster-api and enable turtles', () => {
        cy.setCAPIFeature('embedded-cluster-api', 'false');
        cy.setCAPIFeature('turtles', 'true');
      })
      );

      qase(476, it('Verify rancher-turtles exists and rancher-provisioning-capi does not', {retries: 2}, () => {
        cy.checkKubernetesResource('local', ['Apps', 'Installed Apps'], turtlesHelmApp, true, turtlesNamespace, timeout);
        cy.checkKubernetesResource('local', ['Apps', 'Installed Apps'], capiProvisioningHelmApp, false, capiProvisioningNamespace);
      })
      );

      qase(477, it('Verify core-cluster-api ConfigMap exists', () => {
        cy.checkKubernetesResource('local', ['More Resources', 'Core', 'ConfigMaps'], coreCAPICM, true, capiNamespace, timeout);
      })
      );

      qase(478, it('Reinstall turtles-providers-chart', () => {
        const providerSelectionFunction = (text: any) => {
          // @ts-ignore
          text.providers.infrastructureDocker.enabled = true;
          // @ts-ignore
          text.providers.infrastructureDocker.enableAutomaticUpdate = true;
        }
        // Install Rancher Turtles Certified Providers chart
        cy.checkChart('local', 'Install', vars.turtlesProvidersChartName, turtlesNamespace, {
          version: !isTurtlesDevChart ? '0.25' : undefined,
          modifyYAMLOperation: providerSelectionFunction
        });
      })
      );
    });

    context('[TEARDOWN]', () => {
      qase(479, it('Delete the CAPD cluster', () => {
        capiClusterDeletion(clusterName, timeout);
      })
      );

      qase(480, it('Delete the ClusterClass fleet repo', () => {
        cy.removeFleetGitRepo(clusterClassRepoName);
        capdResourcesCleanup();
      })
      );
    });

  }
});
