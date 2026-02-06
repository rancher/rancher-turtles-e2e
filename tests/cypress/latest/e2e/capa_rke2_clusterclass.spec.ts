import '~/support/commands';
import {qase} from 'cypress-qase-reporter/mocha';
import {getClusterName, isAPIv1beta1, isRancherManagerVersion, skipClusterDeletion} from '~/support/utils';
import {capaResourcesCleanup, capiClusterDeletion, importedRancherClusterDeletion} from "~/support/cleanup_support";
import {vars} from '~/support/variables';

Cypress.config();
describe('Import CAPA RKE2 Class-Cluster', {tags: '@full'}, () => {
  const timeout = 1200000
  const classNamePrefix = 'aws-rke2'
  const clusterName = getClusterName(classNamePrefix)
  const classesPath = 'examples/clusterclasses/aws/rke2'
  const clusterClassRepoName = 'aws-rke2-clusterclass'
  const classClusterFileName = isAPIv1beta1 ? './fixtures/aws/capa-rke2-class-cluster-v1beta1.yaml' : './fixtures/aws/capa-rke2-class-cluster.yaml'

  const providerName = 'aws'
  const accessKey = Cypress.env('aws_access_key')
  const secretKey = Cypress.env('aws_secret_key')

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('[SETUP]', () => {
    it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    })

    // TODO: Create Provider via UI, ref: capi-ui-extension/issues/128
    it('Create AWS CAPIProvider & AWSClusterStaticIdentity', () => {
      if (isRancherManagerVersion('<2.13')) {
        cy.removeCAPIResource('Providers', providerName);
        cy.createCAPIProvider(providerName);
      }
      cy.createAWSClusterStaticIdentity(accessKey, secretKey);
    })

    qase(116,
      it('Add CAPA RKE2 ClusterClass Fleet Repo and check Applications', () => {
        cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
        // Go to CAPI > ClusterClass to ensure the clusterclass is created
        cy.checkCAPIClusterClass(classNamePrefix);

        // Navigate to `local` cluster, More Resources > Fleet > HelmOps and ensure the charts are present.
        cy.checkFleetHelmOps(['aws-ccm', 'aws-csi-driver']);
      })
    );
  })

  context('[CLUSTER-IMPORT]', () => {

    qase(110,
      it('Import CAPA RKE2 class-cluster using YAML', () => {
        cy.readFile(classClusterFileName).then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)
          data = data.replace(/replace_rke2_version/g, vars.rke2Version)
          data = data.replace(/replace_amiID/g, vars.amiID)
          cy.importYAML(data, vars.capiClustersNS)
        });
        // Check CAPI cluster using its name
        cy.checkCAPICluster(clusterName);
      })
    );

    qase(111,
      it('Auto import child CAPA cluster', () => {
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
    qase(112,
      it('Install App on imported cluster', {retries: 1}, () => {
        // Install Chart
        // We install Logging chart instead of Monitoring, since this is relatively lightweight.
        cy.checkChart(clusterName, 'Install', 'Logging', 'cattle-logging-system');
      })
    );

    it("Scale up imported CAPA cluster by patching class-cluster yaml", () => {
      cy.readFile(classClusterFileName).then((data) => {
        data = data.replace(/replicas: 2/g, 'replicas: 3')

        // workaround; these values need to be re-replaced before applying the scaling changes
        data = data.replace(/replace_cluster_name/g, clusterName)
        data = data.replace(/replace_rke2_version/g, vars.rke2Version)
        data = data.replace(/replace_amiID/g, vars.amiID)
        cy.importYAML(data, vars.capiClustersNS)
      })

      // Check CAPI cluster status
      cy.checkCAPIMenu();
      cy.contains('Machine Deployments').click();
      cy.typeInFilter(clusterName);
      cy.get('.content > .count', {timeout: timeout}).should('have.text', '3');
      cy.checkCAPIClusterActive(clusterName);
    })

    it('Remove imported CAPA cluster from Rancher Manager', {retries: 1}, () => {
      // Delete the imported cluster
      // Ensure that the provisioned CAPI cluster still exists
      // this check can fail, ref: https://github.com/rancher/turtles/issues/1587
      importedRancherClusterDeletion(clusterName);
    })
  })

  context('[TEARDOWN]', () => {
    if (skipClusterDeletion) {
      qase(114,
        it('Delete the CAPA cluster', {retries: 1}, () => {
          // Remove CAPI Resources related to the cluster
          capiClusterDeletion(clusterName, timeout);
        })
      );

      qase(115,
        it('Delete the ClusterClass fleet repo and other resources', () => {
          // Remove the clusterclass repo
          cy.removeFleetGitRepo(clusterClassRepoName);
          // Cleanup other resources
          capaResourcesCleanup();
        })
      );
    }
  })
});
