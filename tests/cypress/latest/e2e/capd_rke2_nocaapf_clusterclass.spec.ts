
import '../support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import {skipClusterDeletion, turtlesNamespace, isCaapfDisabled} from '../support/utils';
import {capdResourcesCleanup, capiClusterDeletion, importedRancherClusterDeletion} from "../support/cleanup_support";
import {vars} from '../support/variables';

Cypress.config();
describe('Import CAPD RKE2 (Default CNI & No-Caapf) Class-Cluster using Fleet', {tags: '@short'}, () => {
  let clusterName: string
  const timeout = vars.shortTimeout
  const classNamePrefix = 'docker-rke2'
  const path = '/tests/assets/rancher-turtles-fleet-example/capd/rke2/class-clusters'
  const classesPath = 'examples/clusterclasses/docker/rke2'
  const clustersRepoName = 'docker-rke2-class-clusters'
  const clusterClassRepoName = "docker-rke2-clusterclass"

  beforeEach(function () {
    if (!isCaapfDisabled) {
      // This test is only meant for >=2.14.1
      this.skip();
    }
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('[SETUP]', () => {
    it('Create Docker Resources', () => {
      // Docker rke2 lb-config
      cy.addFleetGitRepo('lb-docker', vars.turtlesRepoUrl, vars.classBranch, 'examples/applications/lb/docker', vars.capiClustersNS);
      cy.burgerMenuOperate('open');
      // Prevention for Docker.io rate limiting
      cy.createDockerAuthSecret();
    });

    it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    })

    it('Install turtles-providers-chart for Docker, RKE2', () => {
      const providerSelectionFunction = (text: any) => {
        // @ts-ignore
        text.providers.infrastructureDocker.enabled = true;
        // @ts-ignore
        text.providers.infrastructureDocker.enableAutomaticUpdate = true;
      }

      // Install Rancher Turtles Certified Providers chart
      cy.checkChart('local', 'Install', vars.turtlesProvidersChartName, turtlesNamespace, {
      version: undefined,
      modifyYAMLOperation: providerSelectionFunction
      });
    })

    it('Add CAPD RKE2 ClusterClass Fleet Repo', () => {
      cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(classNamePrefix);
    })
  })

  context('[CLUSTER-IMPORT]', () => {
    it('Add CAPD cluster fleet repo and get cluster name', () => {
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
  })

  context('[CLUSTER-OPERATIONS]', () => {
    it('Check RKE2 Default CNI', () => {
      cy.contains(clusterName).click();
      cy.accesMenuSelection(['Workloads', 'Pods']);
      cy.setNamespace('All Namespaces', 'all_user');
      // Filter out cni pods by image name
      cy.typeInFilter('calico');
      cy.waitForAllRowsInState('Running', timeout);
    })

    it('Check if cluster is registered in Fleet only once', () => {
      cypressLib.accesMenu('Continuous Delivery');
      cy.contains('Dashboard').should('be.visible');
      cypressLib.accesMenu('Clusters');
      cy.fleetNamespaceToggle('fleet-default');
      // Verify the cluster is registered and Active
      const rowNumber = 0
      cy.verifyTableRow(rowNumber, 'Active', clusterName);
      // Make sure there is only one registered cluster in fleet (there should be one table row)
      cy.get('table.sortable-table').find(`tbody tr[data-testid="sortable-table-${rowNumber}-row"]`).should('have.length', 1);
    })

    it('Check the annotation for externally-managed fleet is not set on cluster', () => {
      cy.searchCluster(clusterName);
      cy.getBySel('sortable-cell-0-1').click();
      cy.getBySel('related').click();
      cy.get('a[href*="management.cattle.io.cluster/c-"]').click();
      const annotation = 'provisioning.cattle.io/externally-managed: \'true\'';
      cy.get('.CodeMirror').then((editor) => {
        // @ts-expect-error known error with CodeMirror
        const text = editor[0].CodeMirror.getValue();
        expect(text).to.not.include(annotation);
      });
    })

    it('Install App on imported cluster', {retries: 1}, () => {
      cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
    })

    it('Remove imported CAPD cluster from Rancher Manager', {retries: 1}, () => {
      // Delete the imported cluster
      // Ensure that the provisioned CAPI cluster still exists
      // this check can fail, ref: https://github.com/rancher/turtles/issues/1587
      importedRancherClusterDeletion(clusterName);
    })
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
      it('Delete the CAPD cluster', {retries: 1}, () => {
        // Remove CAPI Resources related to the cluster
        capiClusterDeletion(clusterName, timeout, clustersRepoName, true);
      })

      it('Delete the ClusterClass fleet repo', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);
        // Cleanup other resources
        capdResourcesCleanup();
      })
    }

    it('Delete the provider-charts and other resources', () => {
      // Remove the lb-config
      cy.removeFleetGitRepo('lb-docker');
      cy.deleteKubernetesResource('local', ['Storage', 'ConfigMaps'], 'docker-rke2-lb-config', vars.capiClustersNS);

      // Uninstall Rancher Turtles Providers chart
      cy.deleteKubernetesResource('local', ['Apps', 'Installed Apps'], vars.turtlesProvidersHelmApp, turtlesNamespace);
      cy.contains(new RegExp(`"${vars.turtlesProvidersHelmApp}"` + ' uninstalled'), {timeout: timeout}).should('be.visible');
      cy.get('.closer').click();
    })
  })
});
