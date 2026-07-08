import '../support/commands';
import {getClusterName, isRancherManagerVersion, skipClusterDeletion} from '../support/utils';
import {capaResourcesCleanup, capiClusterDeletion, importedRancherv3ClusterDeletion} from "../support/cleanup_support";
import {vars} from '../support/variables';

Cypress.config();
describe('Import CAPA RKE2 (No-Caapf) Class-Cluster', {tags: ['@full', '@nocaapf', '@capar-nocaapf']}, () => {
  let ccID: string;
  const timeout = vars.fullTimeout
  const classNamePrefix = 'aws-rke2'
  const clusterName = getClusterName(classNamePrefix)
  const classesPath = 'examples/clusterclasses/aws/rke2'
  const clusterClassRepoName = 'aws-rke2-clusterclass'
  const classClusterFileName = './fixtures/aws/capa-rke2-class-cluster-nocaapf.yaml'

  const providerName = 'aws'
  const accessKey = Cypress.expose('aws_access_key')
  const secretKey = Cypress.expose('aws_secret_key')

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('[SETUP]', () => {
    qase(311, it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    })
    );

    it('Add Cloud credentials & Get Cloud credential ID', () => {
      cy.addCloudCredsAWS(providerName, Cypress.expose('aws_access_key'), Cypress.expose('aws_secret_key'));
      cy.burgerMenuOperate('open');
      cy.accesMenuSelection(['Cluster Management', 'Cloud Credentials']);
      cy.getBySel('sortable-table-list-container').should('be.visible');
      cy.typeInFilter(providerName);
      // Get the CC id
      cy.getBySel('sortable-cell-0-0').then(($cell) => {
        ccID = $cell.text();
        cy.task('suiteLog', `Cloud credential ID: ${ccID}`);
      });
    })

    it('Create AWS CAPIProvider & AWSClusterStaticIdentity', () => {
      if (isRancherManagerVersion('<2.13')) {
        cy.checkCAPIProvider(providerName);
      }
      if (isRancherManagerVersion('<2.15')) {
        cy.createAWSClusterStaticIdentity(accessKey, secretKey);
      } else {
        cy.checkAWSClusterStaticIdentity();
      }
    })

    qase(116,
      it('Add CAPA RKE2 ClusterClass Fleet Repo and check Applications', () => {
        cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
        // Go to CAPI > ClusterClass to ensure the clusterclass is created
        cy.checkCAPIClusterClass(classNamePrefix);
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
          if (isRancherManagerVersion('<2.15')) {
            data = data.replace(/replace_identity_name/g, "cluster-identity")
          } else {
            data = data.replace(/replace_identity_name/g, ccID)
          }
          // AWSClusterStaticIdentity only allows provisioning clusters in "fleet-default"
          cy.importYAML(data);
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
    qase(312, it("Scale up imported CAPA cluster by patching class-cluster yaml", () => {
      cy.readFile(classClusterFileName).then((data) => {
        data = data.replace(/replicas: 2/g, 'replicas: 3')

        // workaround; these values need to be re-replaced before applying the scaling changes
        data = data.replace(/replace_cluster_name/g, clusterName)
        data = data.replace(/replace_rke2_version/g, vars.rke2Version)
        data = data.replace(/replace_amiID/g, vars.amiID)
        if (isRancherManagerVersion('<2.15')) {
          data = data.replace(/replace_identity_name/g, "cluster-identity")
        } else {
          data = data.replace(/replace_identity_name/g, ccID)
        }
        cy.importYAML(data);
      })

      // Check CAPI cluster status
      cy.checkCAPIMenu();
      cy.contains('Machine Deployments').click();
      cy.typeInFilter(clusterName);
      cy.get('.content > .count', {timeout: timeout}).should('have.text', '3');
      cy.checkCAPIClusterActive(clusterName);
    })
    );

    qase(112,
      (isRancherManagerVersion('>2.14') ? it.skip : it)('Install App on imported cluster', {retries: 1}, () => {
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
      qase(360, it('Remove imported CAPA cluster from Rancher Manager', {retries: 1}, () => {
        // Delete the imported cluster
        // Ensure that the provisioned CAPI cluster still exists
        // this check can fail, ref: https://github.com/rancher/turtles/issues/1587
        importedRancherv3ClusterDeletion(clusterName, vars.fleetDefaultNS);
      })
      );

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
          cy.deleteCloudCredsAWS(providerName);
        })
      );
    }
  })
});
