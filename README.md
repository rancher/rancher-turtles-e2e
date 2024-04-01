# rancher-turtles-e2e

What tests are doing:
1. Create the infra stack ( GCP runner, cert-manager, rancher )
2. Install the Turtles operator with locally built nightly chart
3. Deploy the Turtles UI extension
4. Test the Turtles menu, namespaces import features
5. Perform CAPD setup prerequisites
6. Create & Import CAPD cluster using fleet
7. Install App on imported cluster


[![UI-RM_head_2.8](https://github.com/rancher-sandbox/rancher-turtles-e2e/actions/workflows/ui-rm_head_2.8.yaml/badge.svg?branch=main)](https://github.com/rancher-sandbox/rancher-turtles-e2e/actions/workflows/ui-rm_head_2.8.yaml)

## Running the tests locally

### Pre-requisites
1. Install Rancher.
2. Install Rancher Turtles operator.
3. Install CAPI UI Extensions.

### Running the test
1. `cd tests/cypress/latest`
2. Install Cypress and its dependencies: `npm install`
3. Export the following ENV VAR: `RANCHER_URL`, `RANCHER_PASSWORD`, `RANCHER_USERNAME`, `CYPRESS_TAGS=main`.
4. Start Cypress: `./node_modules/cypress/bin/cypress open -C cypress.config.ts`

The Cypress GUI should now be visible.
