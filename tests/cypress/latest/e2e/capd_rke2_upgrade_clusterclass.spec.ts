
import '~/support/commands';
import {getClusterName, isRancherManagerVersion, isAPIv1beta1} from '~/support/utils';
import {capdResourcesCleanup, capiClusterDeletion, importedRancherClusterDeletion} from "~/support/cleanup_support";
import {vars} from '~/support/variables';

Cypress.config();
describe('Import CAPD RKE2 Class-Cluster for Upgrade', {tags: '@upgrade'}, () => {
  const timeout = vars.shortTimeout
  const classNamePrefix = 'docker-rke2'
  const clusterName = getClusterName(classNamePrefix)
  const classesPath = 'examples/clusterclasses/docker/rke2'
  const clusterClassRepoName = 'docker-rke2-clusterclass'
  const classClusterFileName = isAPIv1beta1 ? "./fixtures/docker/capd-rke2-class-cluster-v1beta1.yaml" : "./fixtures/docker/capd-rke2-class-cluster.yaml"
  const dockerAuthUsernameBase64 = btoa(Cypress.expose("docker_auth_username"))
  const dockerAuthPasswordBase64 = btoa(Cypress.expose("docker_auth_password"))

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  context('Pre-Upgrade Resources and Cluster creation', () => {
    if (isRancherManagerVersion('2.13')) {
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
        cy.readFile(classClusterFileName).then((data) => {
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
    }
  })

  context('Post-Upgrade Cluster checks and Resources cleanup', () => {
    if (isRancherManagerVersion('2.14')) {
      it('Check cluster & Resources status post-upgrade', () => {
        // Check CAPI cluster using its name
        cy.checkCAPICluster(clusterName);

        // click the three-dots menu and click View YAML
        cy.getBySel('sortable-table-0-action-button').click();
        cy.contains('View YAML').click();
        cy.get('.CodeMirror').then((editor) => {
          // @ts-expect-error known error with CodeMirror
          const text = editor[0].CodeMirror.getValue();
          expect(text).to.include('apiVersion: cluster.x-k8s.io/v1beta2');
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
        cy.readFile(classClusterFileName).then((data) => {
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

        // Cleanup other resources
        capdResourcesCleanup();

        // Delete the pre-upgrade resources
        cy.removeFleetGitRepo('helm-ops');
        cy.deleteKubernetesResource('local', ['Storage', 'ConfigMaps'], 'docker-rke2-lb-config', vars.capiClustersNS);
        cy.deleteKubernetesResource('local', ['Apps', 'Repositories'], 'turtles-providers-chart');
      })
    }
  })
});
