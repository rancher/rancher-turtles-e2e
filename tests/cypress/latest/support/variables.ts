import {
  isRancherManagerVersion,
  isTurtlesDevChart,
  isUpgrade,
  needsProvidersStgChartName,
  providersChartNeedsStgRegistry
} from './utils';

export const vars = {
  shortTimeout: 600000,
  fullTimeout: 1500000,
  branch: Cypress.expose('turtles_branch'),
  classBranch: isRancherManagerVersion('2.12') ? 'release-0.24' : isRancherManagerVersion('2.13') ? 'release/v0.25' : Cypress.expose('turtles_branch'),
  capiClustersNS: 'capi-clusters',
  capiClassesNS: 'capi-classes',
  repoUrl: 'https://github.com/rancher/rancher-turtles-e2e',
  turtlesRepoUrl: 'https://github.com/rancher/turtles',
  dockerAuthUsernameBase64: btoa(Cypress.expose("docker_auth_username")),
  dockerAuthPasswordBase64: btoa(Cypress.expose("docker_auth_password")),
  turtlesProvidersHelmApp: 'rancher-turtles-providers',
  turtlesProvidersOCIRepo: providersChartNeedsStgRegistry() ? Cypress.expose('providers_stg_oci_repo') : Cypress.expose('providers_oci_repo'), // For alpha|rc|head builds, use stgregistry, for released versions, use regular registry.
  turtlesProvidersChartName: needsProvidersStgChartName() ? 'rancher-turtles-providers' : 'Rancher Turtles Certified Providers', // TODO: Remove this once https://github.com/rancher/rancher/issues/53882 and 53883 is fixed; staging registry is currently broken for everything
  turtlesProvidersChartSelector: isRancherManagerVersion('2.13') && isUpgrade ? 'item-card-cluster/turtles-providers-chart/rancher-turtles-providers' : isTurtlesDevChart ? 'item-card-cluster/chartmuseum-repo/rancher-turtles-providers' : 'item-card-cluster/turtles-providers-chart/rancher-turtles-providers',
  kindVersion: isRancherManagerVersion('2.12') ? 'v1.33.4' : isRancherManagerVersion('2.13') ? 'v1.34.0' : 'v1.35.0',
  k8sVersion: isRancherManagerVersion('2.12') ? 'v1.33.4' : isRancherManagerVersion('2.13') ? 'v1.34.1' : 'v1.35.0',
  rke2Version: isRancherManagerVersion('2.12') ? 'v1.33.4+rke2r1' : isRancherManagerVersion('2.13') ? 'v1.34.1+rke2r1' : 'v1.35.0+rke2r1',
  amiID: isRancherManagerVersion('2.12') ? 'ami-07cded2dd011bc687' // Private copy of ami-0cd9e4e7906f4c9dd from eu-west-2
  : isRancherManagerVersion('2.13') ? 'ami-010b4d392889007a3' // Private copy of ami-055123d49b91c2827 from eu-west-2
  : 'ami-0da7e3e1c75ab13ab', // Private copy of ami-0bb0dc2c3c4dbf68f from eu-west-2
  gcpImageId: isRancherManagerVersion('>=2.13')
  ? 'cluster-api-ubuntu-2404-v1-34-1-1762253907'
  : 'cluster-api-ubuntu-2404-v1-33-5-1762252437',
  chartUpdateOperation: isRancherManagerVersion('>=2.13') ? 'Edit' : 'Update'
};
