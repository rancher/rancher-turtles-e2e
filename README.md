# rancher-turtles-e2e

[![UI-E2E_head_2.15](https://github.com/rancher/rancher-turtles-e2e/actions/workflows/ui-e2e.yaml/badge.svg?event=schedule)](https://github.com/rancher/rancher-turtles-e2e/actions/workflows/ui-e2e.yaml)

What tests are doing:
1. Create the infra stack ( GCP runner, cert-manager, rancher )
2. Install the Turtles chart with locally built latest chart
3. Deploy the Turtles UI extension
4. Test the Turtles menu, namespaces import features
5. Perform CAPI setup prerequisites
6. Create & Import CAPI cluster using fleet by cluster, namespace annotation
7. Install App on imported CAPI cluster
8. Scale the imported CAPI cluster
9. Remove & Delete the imported CAPI cluster
10. Migration test from 2.12 to 2.13 to test turtles migration from an external chart(2.12) to system integrated chart(
    2.13).
11. Upgrade tests from 2.13|2.14 to 2.14|2.15, to test Turtles & CAPI upgrade from v1.10 to v1.12|v1.13
12. Add Feature Switch test for 2.13 to test switch between `embedded-cluster-api` and `turtles` features switch.

## Running the tests locally

### Pre-requisites
1. Install Rancher.
2. Install Rancher Turtles chart.
3. Install CAPI UI Extension.

### Running the test
1. `cd tests/cypress/latest`
2. Install Cypress and its dependencies: `npm install`
3. Export the following ENV VAR: `RANCHER_URL` (format: `https://<FQDN>/dashboard`), `RANCHER_PASSWORD`, `RANCHER_USER`,
   `GREPTAGS=@install [@short @full @upgrade @migration | @vsphere ]`, and provider specific env var:
    1. CAPA - `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
    2. CAPG - `GCP_CREDENTIALS` and `GCP_PROJECT`
    3. CAPZ - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and `AZURE_SUBSCRIPTION_ID`.
    4. CAPV - `VSPHERE_ENDPOINTS_LIST` (workflow only, otherwise hardcoded endpoint_ip is part of the following var), `VSPHERE_SECRETS_JSON_BASE64`, see [here](tests/cypress/latest/e2e/capv_rke2_cluster.spec.ts#L15) for reference.
4. Start Cypress: `./node_modules/cypress/bin/cypress open -C cypress.config.ts` or `npx cypress open --env grepTags="@install @short"`

The Cypress GUI should now be visible.

---

# Test structure
We primarily categorize our tests using tags such as `short`, `full`, `vsphere`, and `install`. 
Tests tagged with `short` are local (docker-based) tests, while those tagged with `vsphere` are specific to vSphere.
Tests tagged with `full` are cloud provider-based tests. The `install` tag is used for initial setup tests ('install' tag is also to be included in setup tests title).

Additional tags that are supported:

| Tag          | Test                                                                                                  |
|--------------|-------------------------------------------------------------------------------------------------------|
| `@install`   | Initial test setup (install rancher, rancher turtles, rancher turtles providers and CAPI UI Extension |
| `@short`     | Docker Provider tests                                                                                 |
| `@full`      | Cloud Providers (CAPA, CAPG, CAPZ) tests                                                              |
| `@vsphere`   | VSphere (CAPV) Provider tests                                                                         |
| `@capXk`     | Provider X (X=Docker, VSphere, Google, Azure, AWS) & Kubeadm                                          |
| `@capXr`     | Provider X (X=Docker, VSphere, Google, Azure, AWS) & RKE2                                             |
| `@capgke`    | CAPG GKE                                                                                              |
| `@capaeks`   | CAPA EKS                                                                                              |
| `@capzaks`   | CAPZ AKS                                                                                              |
| `@migration` | Migration from 2.12 (Externally-managed Rancher Turtles) to 2.13 (System integration Rancher Turtles) |
| `@switch`    | (2.13 Only) Switch from Turtles to Embedded-CAPI and back                                             |
| `@upgrade`   | Upgrade from 2.13|2.14 to 2.14|2.15                                                                   |


# Running tests using Cypress grep
We have implemented tags for more precise selection of tests using a Cypress plugin called [cypress-grep](https://github.com/cypress-io/cypress/tree/develop/npm/grep)

Note: the title can be either at `describe`, `context` or `it` level.

By default, daily runs will run test with the tags`@install`, `@short`

To use locally use the tag `--env grepTags=tag` along with the npx command

For example:
```
npx cypress run -C cypress.config.ts  --env grepTags="@short" cypress/e2e/*.spec.ts
```

# Testing several Rancher versions in one run

The `UI-E2E (multi-version)` workflow ([ui-e2e-multi-version.yaml](.github/workflows/ui-e2e-multi-version.yaml))
runs the same tests once per Rancher version, in parallel, in a single workflow run. Start it manually from the
Actions tab, or with:
```
gh workflow run ui-e2e-multi-version.yaml -f rancher_versions="head/2.16 head/2.13:head/2.14" -f grep_test_by_tag="@install @short"
```
- `rancher_versions` is a list separated by spaces or commas. Each entry is `<version>[:<upgrade_version>]`, where
  `<upgrade_version>` is the post-upgrade/post-migration version (`master-e2e.yaml`'s default is used if omitted).
- Each version gets its own runner and its own result. One failing version does not stop the others.
- `@vsphere` and `@capv` tests are not supported (they share a single vSphere runner); use `UI-E2E` for them.

# Test artifacts

CI runs upload three kinds of artifact:

| Artifact                                            | Contents                                           |
|-----------------------------------------------------|----------------------------------------------------|
| `logs-and-screenshots-<run_number>.tar.gz.gpg`      | Cypress screenshots and the collected cluster logs |
| `cypress-videos-<run_number>.tar.gpg`               | Cypress videos                                     |
| `cypress-videos-after-upgrade-<run_number>.tar.gpg` | Cypress videos from `@migration`/`@upgrade` runs   |

`<run_number>` is actually the cluster name suffix, which defaults to the run number. Runs of the
`UI-E2E (multi-version)` workflow use `<run_number>-<rancher_version>[-to-<upgrade_version>]` instead
(`/` and `:` replaced by `-`), one set per Rancher version, e.g. `cypress-videos-123-head-2.16.tar.gpg`,
`cypress-videos-123-head-2.13-to-head-2.14.tar.gpg`.

All are tarballs encrypted with GPG symmetric AES256, using the `LOG_ENCRYPTION_KEY` repository
secret as the passphrase — ask a repository admin if you need it. Video archives are not gzipped,
since Cypress writes already-compressed mp4.

To inspect one after downloading:
```
gpg --decrypt logs-and-screenshots-123.tar.gpg | tar -xv
gpg --decrypt cypress-videos-123.tar.gpg | tar -xv
```
