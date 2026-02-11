/*
Copyright © 2022 - 2025 SUSE LLC
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

import '~/support/commands';
import {getClusterName, isRancherManagerVersion, turtlesNamespace} from '~/support/utils';
import {capdResourcesCleanup, capiClusterDeletion, importedRancherClusterDeletion} from "~/support/cleanup_support";
import {vars} from '~/support/variables';

Cypress.config();
describe('Import CAPD RKE2 Class-Cluster for Migration', {tags: '@migration'}, () => {
  const timeout = vars.shortTimeout
  const classNamePrefix = 'docker-rke2'
  const clusterName = getClusterName(classNamePrefix)
  const classesPath = 'examples/clusterclasses/docker/rke2'
  const clusterClassRepoName = "docker-rke2-clusterclass"
  const dockerAuthUsernameBase64 = btoa(Cypress.env("docker_auth_username"))
  const dockerAuthPasswordBase64 = btoa(Cypress.env("docker_auth_password"))
  const capdProviderNS = 'capd-system'
  const capdProviderName = 'docker'
  const capdProviderVersion = 'v1.10.6'

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('Pre-Migration Resources and Cluster creation', () => {
    if (isRancherManagerVersion('2.12')) {
      it('Create & Setup the namespace for importing', () => {
        cy.createNamespace([vars.capiClustersNS, vars.capiClassesNS, capdProviderNS]);
        cy.burgerMenuOperate('open');
        cy.namespaceAutoImport('Disable');
      })

      it('Create Docker CAPIProvider & Calico CNI HelmOp', () => {
        // Calico CNI HelmOp
        cy.addFleetGitRepo('calico-cni', vars.turtlesRepoUrl, vars.classBranch, 'examples/applications/cni/calico', vars.capiClustersNS)

        // Docker rke2 lb-config
        cy.burgerMenuOperate('open');
        cy.addFleetGitRepo('lb-docker', vars.turtlesRepoUrl, vars.classBranch, 'examples/applications/lb/docker', vars.capiClustersNS)

        // Create Docker provider
        cy.createCAPIProvider(capdProviderName);
      })

      it('Create Docker Auth Secret', () => {
        // Prevention for Docker.io rate limiting
        cy.readFile('./fixtures/docker/capd-auth-token-secret.yaml').then((data) => {
          data = data.replace(/replace_cluster_docker_auth_username/, dockerAuthUsernameBase64)
          data = data.replace(/replace_cluster_docker_auth_password/, dockerAuthPasswordBase64)
          cy.importYAML(data, vars.capiClustersNS)
        })
      });


      it('Add CAPD RKE2 ClusterClass Fleet Repo', () => {
        cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
        // Go to CAPI > ClusterClass to ensure the clusterclass is created
        cy.checkCAPIClusterClass(classNamePrefix);
      })

      it('Import CAPD RKE2 class-clusters using YAML', () => {
        cy.readFile('./fixtures/docker/capd-rke2-class-cluster.yaml').then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)
          data = data.replace(/replace_rke2_version/g, vars.rke2Version)
          data = data.replace(/replace_kind_version/g, vars.kindVersion)
          cy.importYAML(data, vars.capiClustersNS)
        });

        // Check CAPI cluster using its name
        cy.checkCAPICluster(clusterName);
      })

      it('Auto import child CAPD cluster', () => {
        // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
        cy.checkCAPIClusterProvisioned(clusterName, timeout);

        // Check child cluster is created and auto-imported
        // This is checked by ensuring the cluster is available in navigation menu
        cy.goToHome();
        cy.contains(clusterName).should('exist');

        // Check cluster is Active
        cy.searchCluster(clusterName);
        cy.contains(new RegExp('Active.*' + clusterName), {timeout: timeout});

        // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
        // Ensuring cluster is provisioned also ensures all the Cluster Management > Advanced > Machines for the given cluster are Active.
        cy.checkCAPIClusterActive(clusterName, timeout);
      })

      it('Pre-upgrade steps for migration', () => {
        // Uninstall Rancher Turtles chart
        cy.deleteKubernetesResource('local', ['Apps', 'Installed Apps'], 'rancher-turtles', turtlesNamespace);
        cy.contains(new RegExp('"rancher-turtles" uninstalled'), {timeout: timeout}).should('be.visible');
        cy.get('.closer').click();
        
        // Patch CRDs with cattle-turtles-system namespace
        ['capiproviders.turtles-capi.cattle.io', 'clusterctlconfigs.turtles-capi.cattle.io'].forEach((resourceName) => {
          const resourceKind = 'CustomResourceDefinitions';
          const namespace = turtlesNamespace;
          const patch = {metadata: {annotations: {'meta.helm.sh/release-namespace': 'cattle-turtles-system'}}};
          cy.burgerMenuOperate('open');
          cy.patchYamlResource('local', namespace, resourceKind, resourceName, patch);
        })
      })
    }
  })

  context('Post-Migration Cluster checks and Resources cleanup', () => {
    // Migration script was ran to adopt provider resources into new Helm release (master-e2e.yaml)

    if (isRancherManagerVersion('2.13')) {
      it('Create Fleet Provider using provider charts', () => {
        // Install Rancher Turtles Certified Providers chart with default values
        cy.checkChart('local', 'Install', 'Rancher Turtles Certified Providers', turtlesNamespace, undefined, undefined, false, undefined);
      })

      it('Check cluster & Resources status post-migration', () => {
        // Check Dockerprovider version is auto-upgraded
        cy.checkCAPIProvider(capdProviderName);
        cy.contains(capdProviderVersion);

        // click the three-dots menu and click View YAML
        cy.getBySel('sortable-table-0-action-button').click();
        cy.contains('View YAML').click();
        cy.get('.CodeMirror').then((editor) => {
          // @ts-expect-error known error with CodeMirror
          const text = editor[0].CodeMirror.getValue();
          expect(text).to.include('WranglerManagedCertificates');
        });

        // Check CAPI cluster is Active
        cy.searchCluster(clusterName);
        cy.contains(new RegExp('Active.*' + clusterName), {timeout: timeout});
        cy.checkCAPIClusterActive(clusterName, timeout);
      })

      it('Install App on imported cluster', {retries: 1}, () => {
        // Install Chart
        // We install Logging chart instead of Monitoring, since this is relatively lightweight.
        cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
      })

      it("Scale up imported CAPD cluster by patching class-cluster yaml", () => {
        cy.readFile('./fixtures/docker/capd-rke2-class-cluster.yaml').then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)
          data = data.replace(/replace_rke2_version/g, vars.rke2Version)
          data = data.replace(/replace_kind_version/g, vars.kindVersion)
          data = data.replace(/replicas: 2/g, 'replicas: 3')
          cy.importYAML(data, vars.capiClustersNS)
        });

        // Check CAPI cluster status
        cy.checkCAPIMenu();
        cy.contains('Machine Deployments').click();
        cy.typeInFilter(clusterName);
        cy.get('.content > .count', {timeout: timeout}).should('have.text', '3');
        cy.checkCAPIClusterActive(clusterName);
      })

      it('Remove imported CAPD cluster from Rancher Manager and Delete the CAPD cluster', {retries: 1}, () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        // this check can fail, ref: https://github.com/rancher/turtles/issues/1587
        importedRancherClusterDeletion(clusterName);
        // Remove CAPI Resources related to the cluster
        capiClusterDeletion(clusterName, timeout);
      })

      it('Delete the ClusterClass fleet repo and other resources', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);

        // Remove the cni repo
        cy.removeFleetGitRepo('calico-cni');
        // Remove the lb-config
        cy.removeFleetGitRepo('lb-docker');
        cy.deleteKubernetesResource('local', ['Storage', 'ConfigMaps'], 'docker-rke2-lb-config', vars.capiClustersNS);

        // Cleanup other resources
        capdResourcesCleanup();

        // Uninstall Rancher Turtles providers chart
        cy.deleteKubernetesResource('local', ['Apps', 'Installed Apps'], 'rancher-turtles-providers', turtlesNamespace);
        cy.get('.closer').click();

        // Remove namespaces
        cy.deleteNamespace([vars.capiClassesNS, vars.capiClustersNS, capdProviderNS]);
      })
    }
  })
});
