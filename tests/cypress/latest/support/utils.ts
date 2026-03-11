import semver from 'semver';
// Check the Cypress tags
// Implemented but not used yet

export const isCypressTag = (tag: string) => {
  return (new RegExp(tag)).test(Cypress.expose("cypress_tags"));
}

// Check the K8s version
export const isK8sVersion = (version: string) => {
  version = version.toLowerCase();
  return (new RegExp(version)).test(Cypress.expose("k8s_version"));
}

// Check Rancher Manager version
// Example Usage:
// for rancher_version=head/2.13
// isRancherManagerVersion('>=2.12') returns true
// isRancherManagerVersion('2.13') returns true
// isRancherManagerVersion('<=2.12') returns false
export const isRancherManagerVersion = (version: string) => {
  // rancher_version can be: latest/2.12.1, head/2.12, prime/2.12.3
  // we need to make it semver compliant first
  const rancherVersion = semver.valid(semver.coerce(Cypress.expose('rancher_version')));
  return semver.satisfies(rancherVersion, version)
}

const rancherVersion = Cypress.expose("rancher_version");

// Check if Rancher comes from Prime channel
export const isPrimeChannel = (): boolean => {
  return rancherVersion.includes('prime');
}

// Check if Rancher comes from pre-release Prime channel
export const isPrePrimeChannel = (): boolean => {
  return rancherVersion.includes('prime-alpha') || rancherVersion.includes('prime-rc');
}

const isPreRelease = /(-alpha|-rc|head)/.test(rancherVersion);

// Check if Rancher should use staging registry to install Rancher Turtles Providers Chart
export const providersChartNeedsStgRegistry = (): boolean => {
  return (!isTurtlesDevChart) && (isPreRelease)
}

export const isTurtlesPrimeBuild = (): boolean =>{
  return Cypress.expose("turtles_build_type") === "prime";
}

export const skipClusterDeletion = Cypress.expose("skip_cluster_delete") == "false"

export const getClusterName = (className: string): string => {
  const separator = '-'
  return 'turtles-qa'.concat(separator, className, separator, Cypress.expose('cluster_name_suffix'))
}

export const turtlesNamespace = isRancherManagerVersion('>=2.13') ? 'cattle-turtles-system' : 'rancher-turtles-system'

export const capiNamespace = isRancherManagerVersion('>=2.13') ? 'cattle-capi-system' : 'capi-system'

export const isMigration = Cypress.expose('grepTags') && (Cypress.expose('grepTags')).includes('@migration')

export const isAPIv1beta1 = isRancherManagerVersion('<=2.13')

export const isUpgrade = Cypress.expose('grepTags') && (Cypress.expose('grepTags')).includes('@upgrade')

export const isTurtlesDevChart = Cypress.expose('turtles_dev_chart')
