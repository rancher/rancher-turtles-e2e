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

import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';
import { skipClusterDeletion } from '~/support/utils';
import { Question } from '~/support/structs';


Cypress.config();
describe('Import CAPD RKE2 Class-Cluster', { tags: '@short' }, () => {
  const timeout = 600000
  const className = 'docker-rke2-example'
  const clusterName = className + '-cluster'
  const repoUrl = 'https://github.com/rancher/rancher-turtles-e2e.git'
  const path = '/tests/assets/rancher-turtles-fleet-example/capd/rke2/class-clusters'
  const branch = 'main'
  const questions: Question[] = [
    {
      menuEntry: 'Rancher Turtles Features Settings',
      inputBoxTitle: 'Kubectl Image',
      inputBoxValue: 'registry.k8s.io/kubernetes/kubectl:v1.31.0'
    }
  ];

  const turtlesRepoUrl = 'https://github.com/rancher/turtles'
  const classesPath = 'examples/clusterclasses/docker/rke2'
  const clustersRepoName = 'docker-rke2-class-clusters'
  const clusterClassRepoName = "docker-rke2-clusterclass"

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  it('Setup the namespace for importing', () => {
    cy.namespaceAutoImport('Disable');
  })

  it('Create values.yaml ConfigMap', () => {
    cy.readFile('./fixtures/capd-helm-values.yaml').then((data) => {
      cy.importYAML(data)
    });
  })

  qase(91,
    it('Add CAPD RKE2 ClusterClass Fleet Repo', () => {
      cy.addFleetGitRepo(clusterClassRepoName, turtlesRepoUrl, 'main', classesPath, 'capi-classes')
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(className);
    })
  );

  qase(29,
    it('Add CAPD RKE2 class-clusters fleet repo', () => {
      cypressLib.checkNavIcon('cluster-management').should('exist');
      cy.addFleetGitRepo(clustersRepoName, repoUrl, branch, path);

      // Check CAPI cluster using its name
      cy.checkCAPICluster(clusterName);
    })
  );

  qase(101,
    it('Auto import child CAPD cluster', () => {
      // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
      cy.checkCAPIClusterProvisioned(clusterName, timeout);

      // Check child cluster is created and auto-imported
      // This is checked by ensuring the cluster is available in navigation menu
      cy.goToHome();
      cy.contains(clusterName).should('exist');

      // Check cluster is Active
      cy.searchCluster(clusterName);
      cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });

      // Go to Cluster Management > CAPI > Clusters and check if the cluster has provisioned
      // Ensuring cluster is provisioned also ensures all the Cluster Management > Advanced > Machines for the given cluster are Active.
      cy.checkCAPIClusterActive(clusterName, timeout);
    })
  );

  qase(101,
    it('Install App on imported cluster', () => {
      // Click on imported CAPD cluster
      cy.contains(clusterName).click();

      // Install Chart
      // We install Logging chart instead of Monitoring, since this is relatively lightweight.
      cy.checkChart('Install', 'Logging', 'cattle-logging-system');
    })
  );

  qase(8,
    it("Scale up imported CAPD class-cluster by updating values and forcefully updating the repo", () => {
      cy.readFile('./fixtures/capd-helm-values.yaml').then((data) => {
        data = data.replace(/worker_machine_count: 2/g, 'worker_machine_count: 3')
        cy.importYAML(data)
      });
  
      cy.burgerMenuOperate('open');
      cy.forceUpdateFleetGitRepo(clustersRepoName);
  
      // Check CAPI cluster status
      cy.checkCAPIMenu();
      cy.contains('Machine Deployments').click();
      cy.typeInFilter(clusterName);
      cy.get('.content > .count', { timeout: timeout }).should('have.text', '3');
      cy.checkCAPIClusterActive(clusterName);
    })
  );

  qase(41,
    it('Update chart and check cluster status', () => {
      cy.contains('local').click();
      cy.checkChart('Update', 'Rancher Turtles', 'rancher-turtles-system', '', questions);

      // Check cluster is Active
      cy.searchCluster(clusterName);
      cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });
    })
  );

  if (skipClusterDeletion) {
    qase(103,
      it('Remove imported CAPD cluster from Rancher Manager', { retries: 1 }, () => {
        // Check cluster is not deleted after removal
        cy.deleteCluster(clusterName);
        cy.goToHome();
        // kubectl get clusters.cluster.x-k8s.io
        // This is checked by ensuring the cluster is not available in navigation menu
        cy.contains(clusterName).should('not.exist');
        cy.checkCAPIClusterProvisioned(clusterName);
      })
    );

    qase(104,
      it('Delete the CAPD fleet repos', () => {
        // Remove the clusters fleet repo
        cy.removeFleetGitRepo(clustersRepoName);

        // Wait until the following returns no clusters found
        // This is checked by ensuring the cluster is not available in CAPI menu
        cy.checkCAPIClusterDeleted(clusterName, timeout);

        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);

        // Ensure the cluster is not available in navigation menu
        cy.getBySel('side-menu').then(($menu) => {
          if ($menu.text().includes(clusterName)) {
            cy.deleteCluster(clusterName);
          }
        })
      })
    );

    it('Delete the helm values ConfigMap', () => {
      cy.deleteKubernetesResource('local', ['More Resources', 'Core', 'ConfigMaps'], "capd-helm-values", 'capi-clusters')
    })
  }
});
