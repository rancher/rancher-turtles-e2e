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
export const isRancherManagerVersion = (version: string) => {
  return (new RegExp(version)).test(Cypress.env("rancher_version"));
}

// Check CAPI UI version
export const isUIVersion = (version: string) => {
  return (new RegExp(version)).test(Cypress.env("capi_ui_version"));
}
