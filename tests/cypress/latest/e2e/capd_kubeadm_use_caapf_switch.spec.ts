/*
Copyright © 2022 - 2026 SUSE LLC
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

// TODO: Update all Qase IDs

import '../support/commands';
import {
  getClusterName, isTurtlesDevChart,
  isUseCAAPFSupported,
  skipClusterDeletion,
  turtlesNamespace
} from '../support/utils';
import {capiClusterDeletion, importedRancherv3ClusterDeletion, reImportRancherv3Cluster} from "../support/cleanup_support";
import {vars} from '../support/variables';
import {setUseCAAPFFeatureGate} from "../support/commands";

Cypress.config();
describe('Import CAPD Kubeadm Class-Cluster for Use-CAAPF Migration', {tags: ['@short', '@use-caapf-switch']}, () => {
  const timeout = vars.shortTimeout
  const classNamePrefix = 'docker-kubeadm'
  const clusterName = getClusterName(classNamePrefix)
  const classesPath = 'examples/clusterclasses/docker/kubeadm'
  const clusterClassRepoName = 'docker-kb-clusterclass'
  const classClusterFileName = "./fixtures/docker/capd-kubeadm-class-cluster.yaml"
  let migrationCMD = (phase: 'pre'|'post'): string[] => {
    return ["curl -sSfLO https://raw.githubusercontent.com/rancher/turtles/main/scripts/migrate-caapf.sh", "chmod +x migrate-caapf.sh", `DRY_RUN=false ./migrate-caapf.sh ${phase}`]
  }
  const dockerRegistryConfigBase64 = btoa(Cypress.expose('docker_registry_config'))

  before(function () {
    if (!isUseCAAPFSupported) {
      return cy.task('suiteLog', "use-caapf feature gate is not supported on this Rancher version").then(() => {
        this.skip();
      })
    }
  })

  beforeEach(function () {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('[SETUP]', () => {
    // To validate namespace auto-import
    it('Setup the namespace for importing', () => {
        cy.namespaceAutoImport('Enable');
      });

    it('Add CAPD Kubeadm ClusterClass using fleet', () => {
        cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
        // Go to CAPI > ClusterClass to ensure the clusterclass is created
        cy.checkCAPIClusterClass(classNamePrefix);
      });

    it('Create Docker Pull Secret', () => {
        // Prevention for Docker.io rate limiting
        cy.readFile('./fixtures/docker/capd-image-pull-secret.yaml').then((data) => {
          data = data.replace(/replace_docker_registry_config/, dockerRegistryConfigBase64)
          data = data.replace(/replace_cluster_name/g, clusterName)
          cy.importYAML(data, vars.capiClustersNS)
        })
      });
  })

  context('[CLUSTER-IMPORT]', () => {
    it('Import CAPD Kubeadm class-clusters using YAML', () => {
        cy.readFile(classClusterFileName).then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)
          data = data.replace(/replace_kindVersion/g, vars.kindVersion)
          cy.importYAML(data, vars.capiClustersNS)
        });

        // Check CAPI cluster using its name
        cy.checkCAPICluster(clusterName);
      });

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
      });
  })

  context('[Pre Migration Steps]', ()=> {
    it('Download the migration script and run pre-phase on the local cluster', () => {
      cy.kubectlExecute(migrationCMD('pre'));
    })

    it('Set .helm.force=true for Calico CNI Helm Op', () => {
      ['calico-cni'].forEach((resourceName) => {
        const resourceKind = 'HelmOp';
        const namespace = vars.capiClustersNS;
        const patch = {spec: {helm: {'force': true}}};
        cy.patchYamlResource('local', namespace, resourceKind, resourceName, patch);
      })
    })

    it('Set use-caapf: false', () => {
      setUseCAAPFFeatureGate(false);
    })

    it('Disable fleet-addon provider', () => {
      const providerSelectionFunction = (text: any) => {
        // @ts-ignore
        text.providers.addonFleet.enabled = false;
      }

      // Update Rancher Turtles Certified Providers chart to disable the fleet addon provider
      cy.checkChart('local', vars.chartUpdateOperation, vars.turtlesProvidersChartName, turtlesNamespace, {
        modifyYAMLOperation: providerSelectionFunction,
        version: vars.turtlesProvidersChartVersion
      })
    })
  })

  context('[Post Migration Steps]', ()=>{
    it('Download the migration script and run post-phase', ()=>{
      cy.kubectlExecute(migrationCMD('post'), timeout);
    });

    it('Ensure everything is migrated from capi-clusters to fleet-default',() => {
      cy.checkKubernetesResource('local',["More Resources", "Fleet", "Clusters"] , clusterName, false, vars.capiClustersNS);
      cy.checkKubernetesResource('local',["More Resources", "Fleet", "Clusters"] , clusterName, true, vars.fleetDefaultNS);

      cy.checkKubernetesResource('local',["More Resources", "Fleet", "Cluster Groups"] , classNamePrefix, false, vars.capiClustersNS);
      cy.checkKubernetesResource('local',["More Resources", "Fleet", "Cluster Groups"] , classNamePrefix, true, vars.fleetDefaultNS);
    });
  })

  context('[CLUSTER-OPERATIONS]', () => {

    // Ref: https://github.com/rancher/turtles/issues/1880
    it('Check the fleet-addon annotation and finalizer is removed from clusters', () => {
        // Check the externally-managed annotation is removed from the Rancher management cluster
        cy.checkExternalFleetAnnotation(clusterName, false);

        // Check the finalizer is removed from the CAPI cluster
        cy.viewCAPIClusterYAML(clusterName);
        cy.get('.CodeMirror').then((editor) => {
          // @ts-expect-error known error with CodeMirror
          const text = editor[0].CodeMirror.getValue();
          expect(text).not.to.include('fleet.addons.cluster.x-k8s.io');
        });
      })

    it('Install App on imported cluster', {retries: 1}, () => {
        cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
      });

    it("Scale up imported CAPD cluster by patching class-cluster yaml", () => {
        cy.readFile(classClusterFileName).then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)

          // workaround; these values need to be re-replaced before applying the scaling changes
          data = data.replace(/replace_kindVersion/g, vars.kindVersion)
          data = data.replace(/replicas: 2/g, 'replicas: 3')
          cy.importYAML(data, vars.capiClustersNS)
        });

        // Check CAPI cluster status
        cy.checkCAPIMenu();
        cy.contains('Machine Deployments').click();
        cy.typeInFilter(clusterName);
        cy.get('.content > .count', {timeout: timeout}).should('have.text', '3');
        cy.checkCAPIClusterActive(clusterName);
      });

    it('Re-import the CAPD cluster', () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        importedRancherv3ClusterDeletion(clusterName);

        reImportRancherv3Cluster(clusterName);
      });
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
      it('Remove imported CAPD cluster from Rancher Manager', () => {
          // Delete the imported cluster
          // Ensure that the provisioned CAPI cluster still exists
          importedRancherv3ClusterDeletion(clusterName);
        });

      it('Delete the CAPD cluster', {retries: 1}, () => {
          // Remove CAPI Resources related to the cluster
          capiClusterDeletion(clusterName, timeout);
        });

      it('Delete the ClusterClass fleet repo', () => {
          // Remove the clusterclass repo
          cy.removeFleetGitRepo(clusterClassRepoName);
        });
    }
  })
});
