import '../support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import {isUseCAAPFSupported, skipClusterDeletion, isRancherManagerVersion} from '../support/utils';
import {capdResourcesCleanup, capiClusterDeletion, importedRancherv3ClusterDeletion} from "../support/cleanup_support";
import {vars} from '../support/variables';

Cypress.config();
describe('Import CAPD RKE2 (No-Caapf) Class-Cluster using Fleet', {tags: ['@short', '@nocaapf', '@capdr-nocaapf']}, () => {
  let clusterName: string
  const timeout = vars.shortTimeout
  const classNamePrefix = 'docker-rke2'
  const path = '/tests/assets/rancher-turtles-fleet-example/capd/rke2/class-clusters'
  const classesPath = 'examples/clusterclasses/docker/rke2'
  const clustersRepoName = 'docker-rke2-class-clusters'
  const clusterClassRepoName = "docker-rke2-clusterclass"

  beforeEach(function () {
    if (!isUseCAAPFSupported) {
      // This test is only meant for >=2.14.1
      this.skip();
    }
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('[SETUP]', () => {
    qase(438, it('Create Docker Resources', () => {
      // Docker rke2 lb-config
      cy.addFleetGitRepo('lb-docker', vars.turtlesRepoUrl, vars.classBranch, 'examples/applications/lb/docker', vars.capiClustersNS);
      cy.burgerMenuOperate('open');
      // Prevention for Docker.io rate limiting
      cy.createDockerAuthSecret();
    })
    );

    qase(439, it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    })
    );

    qase(441, it('Add CAPD RKE2 ClusterClass Fleet Repo', () => {
      cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(classNamePrefix);
    })
    );
  })

  context('[CLUSTER-IMPORT]', () => {
    qase(442, it('Add CAPD cluster fleet repo and get cluster name', () => {
      cypressLib.checkNavIcon('cluster-management').should('exist');
      cy.addFleetGitRepo(clustersRepoName, vars.repoUrl, vars.branch, path);

      // Check CAPI cluster using its name prefix i.e. className
      cy.checkCAPICluster(classNamePrefix);
      // Get the cluster name by its prefix and use it across the test
      cy.getBySel('sortable-cell-0-1').then(($cell) => {
        clusterName = $cell.text();
        cy.task('suiteLog',`CAPI Cluster Name: ${clusterName}`);
      });
    })
    );

    qase(443, it('Auto import child CAPD cluster', () => {
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
    );
  })

  context('[CLUSTER-OPERATIONS]', () => {
    qase(444, it('Check RKE2 Default CNI', () => {
      cy.contains(clusterName).click();
      cy.accesMenuSelection(['Workloads', 'Pods']);
      cy.setNamespace('All Namespaces', 'all_user');
      // Filter out cni pods by image name
      cy.typeInFilter('calico');
      cy.waitForAllRowsInState('Running', timeout);
    })
    );

    qase(445, it('Check if cluster is registered in Fleet only once', () => {
      cypressLib.accesMenu('Continuous Delivery');
      cy.contains('Dashboard').should('be.visible');
      cypressLib.accesMenu('Clusters');
      cy.fleetNamespaceToggle(vars.fleetDefaultNS);
      // Verify the cluster is registered and Active
      const rowNumber = 0
      cy.verifyTableRow(rowNumber, 'Active', clusterName);
      // Make sure there is only one registered cluster in fleet (there should be one table row)
      cy.get('table.sortable-table').find(`tbody tr[data-testid="sortable-table-${rowNumber}-row"]`).should('have.length', 1);
    })
    );

    qase(454, it('Check the fleet-addon annotation and finalizer is not set on clusters', () => {
      // Check the externally-managed annotation is not set on Rancher management cluster
      cy.checkExternalFleetAnnotation(clusterName, false);

      // Check the finalizer is not set on CAPI cluster
      cy.viewCAPIClusterYAML(clusterName);
      cy.get('.CodeMirror').then((editor) => {
        // @ts-expect-error known error with CodeMirror
        const text = editor[0].CodeMirror.getValue();
        expect(text).not.to.include('fleet.addons.cluster.x-k8s.io');
      });
    })
    );

    qase(447, (isRancherManagerVersion('>2.14') ? it.skip : it)('Install App on imported cluster', {retries: 1}, () => {
      cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
    })
    );

    it('Check for any errors in Turtles logs', () => {
      // Check for any errors
      cy.filterPodErrorLogs('rancher-turtles-controller-manager');
    })
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
      qase(448, it('Remove imported CAPD cluster from Rancher Manager', () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        importedRancherv3ClusterDeletion(clusterName);
      })
      );

      qase(449, it('Delete the CAPD cluster', {retries: 1}, () => {
        // Remove CAPI Resources related to the cluster
        capiClusterDeletion(clusterName, timeout, clustersRepoName, true);
      })
      );

      qase(450, it('Delete the ClusterClass fleet repo', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);
        // Cleanup other resources
        capdResourcesCleanup();
      })
      );
    }

    qase(451, it('Delete the docker resources', () => {
      // Remove the lb-config
      cy.removeFleetGitRepo('lb-docker');
      cy.deleteKubernetesResource('local', ['Storage', 'ConfigMaps'], 'docker-rke2-lb-config', vars.capiClustersNS);
    })
    );
  })
});
