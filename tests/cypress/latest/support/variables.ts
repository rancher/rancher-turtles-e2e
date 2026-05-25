import {isAPIv1beta1, isRancherManagerVersion, providersChartNeedsStgRegistry} from './utils';

export const vars = {
  shortTimeout: 600000,
  fullTimeout: 1500000,
  branch: Cypress.expose('turtles_branch'),
  classBranch: isRancherManagerVersion('2.12') ? 'release-0.24' : isRancherManagerVersion('2.13') ? 'release/v0.25' : isRancherManagerVersion('2.14') ? 'release/v0.26' : Cypress.expose('turtles_branch'),
  capiClustersNS: 'capi-clusters',
  capiClassesNS: 'capi-classes',
  repoUrl: 'https://github.com/rancher/rancher-turtles-e2e',
  turtlesRepoUrl: 'https://github.com/rancher/turtles',
  dockerAuthUsernameBase64: btoa(Cypress.expose("docker_auth_username")),
  dockerAuthPasswordBase64: btoa(Cypress.expose("docker_auth_password")),
  turtlesProvidersHelmApp: 'rancher-turtles-providers',
  turtlesProvidersOCIRepo: providersChartNeedsStgRegistry() ? Cypress.expose('providers_stg_oci_repo') : Cypress.expose('providers_oci_repo'), // For alpha|rc|head builds, use stgregistry, for released versions, use regular registry.
  turtlesProvidersChartName: 'rancher-turtles-providers',
  eksVersion: isAPIv1beta1 ? 'v1.32.0' : 'v1.35.4',
  aksVersion: isRancherManagerVersion('2.12') ? 'v1.33.4' : isRancherManagerVersion('2.13') ? 'v1.34.7' : 'v1.35.4',
  kindVersion: isRancherManagerVersion('2.12') ? 'v1.33.4' : isRancherManagerVersion('2.13') ? 'v1.34.0' : isRancherManagerVersion('2.14') ? 'v1.35.0' : 'v1.36.1',
  kubeadmVersion: isRancherManagerVersion('2.12') ? 'v1.33.4' : isRancherManagerVersion('2.13') ? 'v1.34.1' : isRancherManagerVersion('2.14') ? 'v1.35.0' : 'v1.36.1',
  rke2Version: isRancherManagerVersion('2.12') ? 'v1.33.4+rke2r1' : isRancherManagerVersion('2.13') ? 'v1.34.1+rke2r1' : isRancherManagerVersion('2.14') ? 'v1.35.0+rke2r1' : 'v1.36.0+rke2r1',
  v2provRKE2Version: isRancherManagerVersion('2.12') ? 'v1.33.4+rke2r1' : isRancherManagerVersion('2.13') ? 'v1.34.1+rke2r1' : 'v1.35.4+rke2r1',
  amiID: isRancherManagerVersion('2.12') ? 'ami-07cded2dd011bc687' // Private copy of ami-0cd9e4e7906f4c9dd from eu-west-2
  : isRancherManagerVersion('2.13') ? 'ami-010b4d392889007a3' // Private copy of ami-055123d49b91c2827 from eu-west-2
  : isRancherManagerVersion('2.14') ? 'ami-0da7e3e1c75ab13ab' // Private copy of ami-0bb0dc2c3c4dbf68f from eu-west-2
  : 'ami-05402dfd155c256a5', // Private copy of ami-032938cfb36a7f7ce from eu-west-2
  gcpImageId: isRancherManagerVersion('2.12')
  ? 'cluster-api-ubuntu-2404-v1-33-5-1762252437'
  : isRancherManagerVersion('2.13')
  ? 'cluster-api-ubuntu-2404-v1-34-1-1762253907'
  : isRancherManagerVersion('2.14')
  ? 'cluster-api-ubuntu-2404-v1-35-0-1770652401'
  : 'cluster-api-ubuntu-2404-v1-36-1-1779178908',
  chartUpdateOperation: isRancherManagerVersion('>=2.13') ? 'Edit' : 'Update'
};
