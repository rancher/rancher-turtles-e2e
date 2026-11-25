import '../support/commands';
import {
  getClusterName,
  skipClusterDeletion,
  isCAAPFSupported,
} from '../support/utils';
import {capiClusterDeletion, importedRancherv3ClusterDeletion} from "../support/cleanup_support";
import {vars} from '../support/variables';

Cypress.config();
describe('Import CAPD RKE2 Cluster', {tags: ['@short', '@capdr']}, () => {
  const timeout = vars.shortTimeout
  const classNamePrefix = 'docker-rke2'
  const clusterName = getClusterName(classNamePrefix)
  const classesPath = 'examples/clusterclasses/docker/rke2'
  const clusterClassRepoName = 'docker-rke2-clusterclass'
  const clusterFileName = './fixtures/docker/capd-rke2-cluster.yaml'

  before(function () {
    if (isCAAPFSupported) {
      return cy.task('suiteLog', "Test uses RancherManagedFleet which is only supported on Rancher Version 2.16 onwards; skipping...").then(() => {
        this.skip();
      })
    }
  })

  beforeEach(function () {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('[SETUP]', () => {
    it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    })

    it('Create Docker Auth Secret', () => {
      // Prevention for Docker.io rate limiting
      cy.createDockerAuthSecret();
    })

    it('Add CAPD RKE2 ClusterClass Fleet Repo', () => {
      cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(classNamePrefix);
    })
  })

  context('[CLUSTER-IMPORT]', () => {
    it('Import CAPD RKE2 cluster using YAML', () => {
      cy.readFile(clusterFileName).then((data) => {
        data = data.replace(/replace_cluster_name/g, clusterName)
        data = data.replace(/replace_rke2_version/g, vars.rke2Version)
        data = data.replace(/replace_kind_version/g, vars.kindVersion)
        cy.importYAML(data, vars.capiClustersNS)
      });

      // Check CAPI cluster using its name
      cy.checkCAPICluster(clusterName);

      // Check CAPI cluster status
      cy.checkCAPIClusterCPInitialized(clusterName);
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
    it('Check the fleet-addon annotation and finalizer is not set on clusters', () => {
      // Check the externally-managed annotation is not set on Rancher management cluster
      cy.checkExternalFleetAnnotation(clusterName, false);

      // Check the finalizer is not set on CAPI cluster
      cy.viewCAPIClusterYAML(clusterName);
      cy.checkYAMLText('fleet.addons.cluster.x-k8s.io', false);
    })

    it('Install App on imported cluster', {retries: 1}, () => {
      cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
    })

    it("Scale up imported CAPD cluster by patching cluster yaml", () => {
      cy.readFile(clusterFileName).then((data) => {
        data = data.replace(/replicas: 2/g, 'replicas: 3')

        // workaround; these values need to be re-replaced before applying the scaling changes
        data = data.replace(/replace_cluster_name/g, clusterName)
        data = data.replace(/replace_rke2_version/g, vars.rke2Version)
        data = data.replace(/replace_kind_version/g, vars.kindVersion)
        cy.importYAML(data, vars.capiClustersNS)
      });

      // Check CAPI cluster status
      cy.checkCAPIMenu();
      cy.contains('Machine Deployments').click();
      cy.typeInFilter(clusterName);
      cy.get('.content > .count', {timeout: timeout}).should('have.text', '3');
      cy.checkCAPIClusterActive(clusterName);
    })

    it('Check for any errors in Turtles logs', () => {
      // Check for any errors
      cy.filterPodErrorLogs('rancher-turtles-controller-manager');
    })
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
      it('Remove imported CAPD cluster from Rancher Manager', () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        importedRancherv3ClusterDeletion(clusterName);
      })
      
      it('Delete the CAPD cluster', () => {
          // Remove CAPI Resources related to the cluster
          capiClusterDeletion(clusterName, timeout);
      })
      
      it('Delete the ClusterClass fleet repo', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);
      })
    }
  })
});
