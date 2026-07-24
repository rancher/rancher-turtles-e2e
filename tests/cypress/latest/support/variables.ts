import {
  isAPIv1beta1,
  isRancherManagerVersion,
  isTurtlesDevChart, isUpgrade,
  providersChartNeedsStgRegistry
} from './utils';

const primeRegistry = Cypress.expose('prime_registry');
const stgPrimeRegistry = Cypress.expose('stg_prime_registry');
const turtlesProvidersRegistry = providersChartNeedsStgRegistry() ? stgPrimeRegistry : primeRegistry;

export const vars = {
  shortTimeout: 600000,
  fullTimeout: 1500000,
  branch: Cypress.expose('turtles_branch'),
  classBranch: isRancherManagerVersion('2.12') ? 'release-0.24' : isRancherManagerVersion('2.13') ? 'release/v0.25' : isRancherManagerVersion('2.14') ? 'release/v0.26' : isRancherManagerVersion('2.15') ? 'release/v0.27' : Cypress.expose('turtles_branch'),
  capiClustersNS: 'capi-clusters',
  capiClassesNS: 'capi-classes',
  fleetDefaultNS: 'fleet-default',
  cattleSystemNS: 'cattle-system',
  repoUrl: 'https://github.com/rancher/rancher-turtles-e2e',
  turtlesRepoUrl: 'https://github.com/rancher/turtles',
  dockerAuthUsernameBase64: btoa(Cypress.expose("docker_auth_username")),
  dockerAuthPasswordBase64: btoa(Cypress.expose("docker_auth_password")),
  primeRegistry: primeRegistry,
  stgPrimeRegistry: stgPrimeRegistry,
  turtlesProvidersHelmApp: 'rancher-turtles-providers',
  turtlesProvidersOCIRepo: `oci://${turtlesProvidersRegistry}/rancher/charts/rancher-turtles-providers`,
  turtlesProvidersChartName: 'rancher-turtles-providers',
  eksVersion: isAPIv1beta1 ? 'v1.32.0' : 'v1.35.4',
  aksVersion: isRancherManagerVersion('2.12') ? 'v1.33.4' : isRancherManagerVersion('2.13') ? 'v1.34.7' : 'v1.35.4',
  kindVersion: isRancherManagerVersion('2.12') ? 'v1.33.4' : isRancherManagerVersion('2.13') ? 'v1.34.0' : isRancherManagerVersion('2.14') ? 'v1.35.0' : 'v1.36.1',
  kubeadmVersion: isRancherManagerVersion('2.12') ? 'v1.33.4' : isRancherManagerVersion('2.13') ? 'v1.34.1' : isRancherManagerVersion('2.14') ? 'v1.35.0' : 'v1.36.1',
  rke2Version: isRancherManagerVersion('2.12') ? 'v1.33.4+rke2r1' : isRancherManagerVersion('2.13') ? 'v1.34.1+rke2r1' : isRancherManagerVersion('2.14') ? 'v1.35.0+rke2r1' : 'v1.36.0+rke2r1',
  v2provRKE2Version: isRancherManagerVersion('2.12') ? 'v1.33.4+rke2r1' : isRancherManagerVersion('2.13') ? 'v1.34.8+rke2r2' : 'v1.35.4+rke2r1',
  amiID: isRancherManagerVersion('2.12') ? 'ami-07cded2dd011bc687' // Private copy of ami-0cd9e4e7906f4c9dd from eu-west-2
  : isRancherManagerVersion('2.13') ? 'ami-010b4d392889007a3' // Private copy of ami-055123d49b91c2827 from eu-west-2
  : isRancherManagerVersion('2.14') ? 'ami-0da7e3e1c75ab13ab' // Private copy of ami-0bb0dc2c3c4dbf68f from eu-west-2
  : 'ami-05402dfd155c256a5', // Private copy of ami-032938cfb36a7f7ce from eu-west-2
  gcpImageId: isRancherManagerVersion('2.12')
  ? 'cluster-api-ubuntu-2404-v1-33-5-1762252437'
  : isRancherManagerVersion('2.13') || isRancherManagerVersion('2.14')
  ? 'cluster-api-ubuntu-2404-v1-34-1-1762253907' // Same version used for 2.13, 2.14
  : 'cluster-api-ubuntu-2404-v1-36-1-1779178908',
  chartUpdateOperation: isRancherManagerVersion('>=2.13') ? 'Edit' : 'Update',
  azureCCMVersion: '1.36.0',
  calicoCNIYaml: 'https://raw.githubusercontent.com/rancher/turtles/refs/heads/main/test/e2e/data/applications/calico.yaml',
  azureCCMYaml: 'https://raw.githubusercontent.com/rancher/turtles/refs/heads/main/test/e2e/data/applications/cloud-provider-azure.yaml',
  gcpCCMYaml: 'https://raw.githubusercontent.com/rancher/turtles/refs/heads/main/test/e2e/data/applications/cloud-provider-gcp.yaml',
  vSphereCCMYaml: 'https://raw.githubusercontent.com/rancher/turtles/refs/heads/main/test/e2e/data/applications/cloud-provider-vsphere.yaml',
  vSphereCSIYaml: 'https://raw.githubusercontent.com/rancher/turtles/refs/heads/main/test/e2e/data/applications/csi-vsphere.yaml',
  turtlesProvidersChartVersion: (() => {
    if (isUpgrade && isRancherManagerVersion('2.13')) {
      // for upgrade tests, 2.13 will always be dev=false; dev=true is only applicable to 2.14
      return '0.25';
    }

    if (!isTurtlesDevChart && providersChartNeedsStgRegistry()) {
      if (isRancherManagerVersion('2.13')) return '0.25';
      if (isRancherManagerVersion('2.14')) return '0.26';
      if (isRancherManagerVersion('2.15')) return '0.27';
    }
    // for stable releases, only supported versions will be listed, so we do not need to return/select a specific
    // versions; selecting a version is only necessary for alpha/rc/head builds where we use staging registry that
    // consists of unsupported versions
    return undefined;
  })()
};

type BuildType = 'prod-v2.12' | 'prod-v2.13' | 'prod-v2.14' | 'prod-v2.15' | 'dev-v2.12' | 'dev-v2.13' | 'dev-v2.14' | 'dev-v2.15';

const buildType = ((): BuildType => {
  if (isTurtlesDevChart && isRancherManagerVersion('2.12')){
    return 'dev-v2.12';
  }
  if (isTurtlesDevChart && isRancherManagerVersion('2.13')) {
    return 'dev-v2.13';
  }
  if (isTurtlesDevChart && isRancherManagerVersion('2.14')) {
    return 'dev-v2.14';
  }
  if (isTurtlesDevChart && isRancherManagerVersion('2.15')) {
    return 'dev-v2.15';
  }
  if(isRancherManagerVersion('2.12')){
    return 'prod-v2.12';
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
  // This should never happen
  throw new Error('Unable to determine BuildType from Rancher Manager version and chart settings');
})()

const buildTypeVersionMap = {
  'prod-v2.12': {
    capi: 'v1.10.5',
    rke2: 'v0.20.1',
    kubeadm: 'v1.10.5',
    fleet: 'v0.11.0',
    vsphere: 'v1.13.1',
    amazon: 'v2.9.1',
    google: 'v1.10.0',
    azure: 'v1.21.0'
  },
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
    capi: 'v1.13.3',
    rke2: 'v0.25.0',
    kubeadm: 'v1.13.3',
    fleet: 'v0.15.0',
    vsphere: 'v1.16.1',
    amazon: 'v2.11.1',
    google: 'v1.11.2',
    azure: 'v1.23.2'
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
    capi: 'v1.13.3',
    rke2: 'v0.25.0',
    kubeadm: 'v1.13.3',
    fleet: 'v0.15.0',
    vsphere: 'v1.16.1',
    amazon: 'v2.11.1',
    google: 'v1.11.2',
    azure: 'v1.23.2'
  }
}

export const providers = {
  coreCAPIProvider: 'cluster-api',
  rke2Provider: 'rke2',
  kubeadmProvider: 'kubeadm',
  dockerProvider: 'docker',
  amazonProvider: 'aws',
  googleProvider: 'gcp',
  azureProvider: 'azure',
  fleetProvider: 'fleet',
  vsphereProvider: 'vsphere',
  coreCAPIProviderVersion: buildTypeVersionMap[buildType].capi,
  rke2ProviderVersion: buildTypeVersionMap[buildType].rke2,
  kubeadmProviderVersion: buildTypeVersionMap[buildType].kubeadm,
  fleetProviderVersion: buildTypeVersionMap[buildType].fleet,
  vsphereProviderVersion: buildTypeVersionMap[buildType].vsphere,
  amazonProviderVersion: buildTypeVersionMap[buildType].amazon,
  googleProviderVersion: buildTypeVersionMap[buildType].google,
  azureProviderVersion: buildTypeVersionMap[buildType].azure
}
