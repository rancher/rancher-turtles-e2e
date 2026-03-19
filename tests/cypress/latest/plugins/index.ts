/*
Copyright © 2022 - 2023 SUSE LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import randomstring from "randomstring";

/// <reference types="cypress" />

/**
 * @type {Cypress.PluginConfig}
 */
module.exports = (on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config
  const url = process.env.RANCHER_URL || 'https://localhost:8005';

  const {isFileExist, findFiles} = require('cy-verify-downloads');
  on('task', {isFileExist, findFiles})

  config.baseUrl = url.replace(/\/$/, '');
  config.expose.cache_session = process.env.CACHE_SESSION || false;
  config.expose.chartmuseum_repo = process.env.CHARTMUSEUM_REPO || '';
  config.expose.turtles_dev_chart = process.env.TURTLES_DEV_CHART == "true";
  config.expose.turtles_chart_version = process.env.TURTLES_CHART_VERSION;
  config.expose.turtles_build_type = process.env.BUILD_TYPE || "prime";
  config.expose.cluster = process.env.CLUSTER_NAME;
  config.expose.k8s_version = process.env.K8S_VERSION_TO_PROVISION;
  config.expose.rancher_version = process.env.RANCHER_VERSION;
  config.expose.turtles_branch = process.env.TURTLE_BRANCH || 'main';
  config.expose.username = process.env.RANCHER_USER;
  config.expose.grep = process.env.GREP;
  config.expose.grepTags = process.env.GREPTAGS;
  config.expose.skip_cluster_delete = process.env.SKIP_CLUSTER_DELETE || "false";
  const clusterNameSuffixDefault: string = randomstring.generate({length: 4, capitalization: 'lowercase'})
  config.expose.cluster_name_suffix = process.env.CLUSTER_NAME_SUFFIX || clusterNameSuffixDefault;
  config.env.providers_oci_repo = process.env.PROVIDERS_OCI_REPO;
  config.env.providers_stg_oci_repo = process.env.PROVIDERS_STG_OCI_REPO;

  // Secrets
  config.expose.password = process.env.RANCHER_PASSWORD;
  config.expose.aws_access_key = process.env.AWS_ACCESS_KEY_ID;
  config.expose.aws_secret_key = process.env.AWS_SECRET_ACCESS_KEY;
  config.expose.gcp_credentials = process.env.GCP_CREDENTIALS;
  config.expose.gcp_project = process.env.GCP_PROJECT;
  config.expose.azure_tenant_id = process.env.AZURE_TENANT_ID;
  config.expose.azure_client_id = process.env.AZURE_CLIENT_ID;
  config.expose.azure_client_secret = process.env.AZURE_CLIENT_SECRET;
  config.expose.azure_subscription_id = process.env.AZURE_SUBSCRIPTION_ID;
  config.expose.docker_auth_username = process.env.DOCKER_AUTH_USERNAME;
  config.expose.docker_auth_password = process.env.DOCKER_AUTH_PASSWORD;
  config.expose.docker_registry_config = process.env.DOCKER_REGISTRY_CONFIG;
  // VMware vSphere
  config.expose.vsphere_secrets_json_base64 = process.env.VSPHERE_SECRETS_JSON_BASE64;

  // To know if tests are running in a CI environment
  config.expose.ci = process.env.CI;

  return config;
};
