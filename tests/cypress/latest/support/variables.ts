import {isRancherManagerVersion, providersChartNeedsStgRegistry,} from '~/support/utils';

export const vars = {
  shortTimeout: 600000,
  fullTimeout: 1500000,
  branch: Cypress.expose('turtles_branch'),
  classBranch: isRancherManagerVersion("2.13") && !Cypress.expose('turtles_dev_chart') ? "release/v0.25" : Cypress.expose('turtles_branch'),
  capiClustersNS: 'capi-clusters',
  capiClassesNS: 'capi-classes',
  repoUrl: 'https://github.com/rancher/rancher-turtles-e2e',
  turtlesRepoUrl: 'https://github.com/rancher/turtles',
  turtlesProvidersOCIRepo: providersChartNeedsStgRegistry() ? 'oci://stgregistry.suse.com/rancher/charts/rancher-turtles-providers' : 'oci://registry.suse.com/rancher/charts/rancher-turtles-providers', // For alpha|rc|head builds, use stgregistry, for released versions, use regular registry.
  turtlesProvidersChartName: providersChartNeedsStgRegistry() ? 'rancher-turtles-providers' : 'Rancher Turtles Certified Providers', // TODO: Remove this once https://github.com/rancher/rancher/issues/53882 and 53883 is fixed; staging registry is currently broken for everything
  kindVersion: isRancherManagerVersion('>=2.13')
  ? 'v1.34.0'
  : 'v1.33.4',
  k8sVersion: isRancherManagerVersion('>=2.13')
  ? 'v1.34.1'
  : 'v1.33.5',
  rke2Version: isRancherManagerVersion('>=2.13')
  ? 'v1.34.1+rke2r1'
  : 'v1.33.5+rke2r1',
  amiID: isRancherManagerVersion('>=2.13')
  ? 'ami-010b4d392889007a3' // Private copy of ami-055123d49b91c2827 from eu-west-2
  : 'ami-07cded2dd011bc687', // Private copy of ami-0cd9e4e7906f4c9dd from eu-west-2
  gcpImageId: isRancherManagerVersion('>=2.13')
  ? 'cluster-api-ubuntu-2404-v1-34-1-1762253907'
  : 'cluster-api-ubuntu-2404-v1-33-5-1762252437'
};
