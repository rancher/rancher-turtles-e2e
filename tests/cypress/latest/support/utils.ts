import semver from 'semver';
// Check the Cypress tags
// Implemented but not used yet

export const isCypressTag = (tag: string) => {
  return (new RegExp(tag)).test(Cypress.env("cypress_tags"));
}

// Check the K8s version
export const isK8sVersion = (version: string) => {
  version = version.toLowerCase();
  return (new RegExp(version)).test(Cypress.env("k8s_version"));
}

// Check Rancher Manager version
// Example Usage:
// for rancher_version=head/2.13
// isRancherManagerVersion('>=2.12') returns true
// isRancherManagerVersion('2.13') returns true
// isRancherManagerVersion('<=2.11') returns false
export const isRancherManagerVersion = (version: string) => {
  // rancher_version can be: latest/2.12.1, head/2.12, prime/2.11.1
  // we need to make it semver compliant first
  const rancherVersion = semver.valid(semver.coerce(Cypress.env('rancher_version')));
  return semver.satisfies(rancherVersion, version)
}

// Check CAPI UI version
export const isUIVersion = (version: string) => {
  return (new RegExp(version)).test(Cypress.env("capi_ui_version"));
}

export const skipClusterDeletion = Cypress.env("skip_cluster_delete") == "false"

export const getClusterName = (className: string): string => {
  const separator = '-'
  return 'turtles-qa'.concat(separator, className, separator, Cypress.env('cluster_name_suffix'))
}

// Poll /dashboard/about until it returns HTTP 200 and then reload the page
export const checkApiStatus = (retries = 25) => {
  cy.request({
    url: '/about',
    failOnStatusCode: false,
    timeout: 30000,
  }).then((response) => {
    if (response.status !== 200 && retries > 0) {
      cy.wait(5000);
      checkApiStatus(retries - 1);
    } else {
      expect(response.status).to.eq(200);
      // Once /dashboard/about is back, reload the page
      cy.wait(5000);
      cy.reload();
      cy.wait(2000);
    }
  });
}
