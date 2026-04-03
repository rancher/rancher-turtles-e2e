import semver from 'semver';
// Check the Cypress tags
// Implemented but not used yet

export const isCypressTag = (tag: string) => {
  return Cypress.expose('grepTags').includes(tag);
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
  return rancherVersion.includes('prime-alpha') || rancherVersion.includes('prime-rc')
}

export const isPreRelease = /(-alpha|-rc)/.test(rancherVersion);
export const isHeadBuild = rancherVersion.includes('head');


// Check if Rancher should use staging registry to install Rancher Turtles Providers Chart
export const providersChartNeedsStgRegistry = (): boolean => {
  return (!isTurtlesDevChart) && (isPreRelease || isHeadBuild);
}

// Check if Rancher Turtles Providers chart should use staging registry chart name
// Returns true for Rancher 2.13 alpha/rc builds
// TODO: Remove this once https://github.com/rancher/rancher/issues/53882 and 53883 is fixed; staging registry is currently broken for everything
export const needsProvidersStgChartName = (): boolean => {
  return isRancherManagerVersion('2.13') && isPreRelease && !isTurtlesDevChart
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

export const isMigration = isCypressTag('@migration')

export const isAPIv1beta1 = isRancherManagerVersion('<=2.13')

export const isUpgrade = isCypressTag('@upgrade')

export const isTurtlesDevChart = Cypress.expose('turtles_dev_chart')
