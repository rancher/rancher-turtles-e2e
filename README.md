# rancher-turtles-e2e

[![UI-E2E_head_2.10](https://github.com/rancher-sandbox/rancher-turtles-e2e/actions/workflows/ui-e2e.yaml/badge.svg?branch=main)](https://github.com/rancher-sandbox/rancher-turtles-e2e/actions/workflows/ui-e2e.yaml)

What tests are doing:
1. Create the infra stack ( GCP runner, cert-manager, rancher )
2. Install the Turtles operator with locally built latest chart
3. Deploy the Turtles UI extension
4. Test the Turtles menu, namespaces import features
5. Perform CAPI setup prerequisites
6. Create & Import CAPI cluster using fleet by cluster, namespace annotation
7. Install App on imported CAPI cluster
8. Scale the imported CAPI cluster
9. Remove & Delete the imported CAPI cluster


## Running the tests locally

### Pre-requisites
1. Install Rancher.
2. Install Rancher Turtles operator.
3. Install CAPI UI Extensions.

### Running the test
1. `cd tests/cypress/latest`
2. Install Cypress and its dependencies: `npm install`
3. Export the following ENV VAR: `RANCHER_URL` (format: `https://<FQDN>/dashboard`), `RANCHER_PASSWORD`, `RANCHER_USER`, `CYPRESS_TAGS=main`, and provider specific env var:
    1. CAPA - `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
    2. CAPG - `GCP_CREDENTIALS`
    3. CAPZ - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_SUBSCRIPTION_ID`, and `AZURE_LOCATION`.
4. Start Cypress: `./node_modules/cypress/bin/cypress open -C cypress.config.ts`

The Cypress GUI should now be visible.

---

# Test structure
Currently, we divide our tests by tags (`short`, `full`,...). Aside of this we have an initial one, `install`.
Specs with `short` tag are local (docker) based tests and with `full` tag are cloud providers based tests.

# Running tests using Cypress grep
We have implemented tags for more precise selection of tests using a Cypress plugin called [cypress-grep](https://github.com/cypress-io/cypress/tree/develop/npm/grep)

Note: the title can be either at `describe`, `context` or `it` level.

By default, daily runs will run test with the tags`@install`, `@short`

To use locally use the tag `--env grepTags=tag` along with the npx command

For example:
```
npx cypress run -C cypress.config.ts  --env grepTags="@short" cypress/e2e/unit_tests/*.spec.ts
```
