import '../support/commands';
import {getClusterName, isUseCAAPFSupported, skipClusterDeletion, turtlesNamespace, isRancherManagerVersion, getCAPIClusterKubeconfig, applyYAMLManifest, providersChartNeedsStgRegistry} from '../support/utils';
import {capiClusterDeletion, importedRancherv3ClusterDeletion} from "../support/cleanup_support";
import {vars} from '../support/variables';

Cypress.config();
describe('Import CAPD Kubeadm (No-Caapf) Class-Cluster', {tags: ['@short', '@nocaapf']}, () => {
  const timeout = vars.shortTimeout
  const classNamePrefix = 'docker-kubeadm'
  const clusterName = getClusterName(classNamePrefix)
  const classesPath = 'examples/clusterclasses/docker/kubeadm'
  const clusterClassRepoName = "docker-kb-clusterclass"
  const classClusterFileName = "./fixtures/docker/capd-kubeadm-class-cluster-nocaapf.yaml"

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
      cy.createNamespace([vars.capiClustersNS]);
    })
    );

    qase(439, it('Setup the namespace for importing', () => {
      cy.namespaceAutoImport('Disable');
    })
    );

    // We install providers chart here because the test runs before providers_setup.spec.ts
    // TODO: Move providers installation to separate file
    qase(440, it('Install turtles-providers-chart for all providers', () => {
      const providerSelectionFunction = (text: any) => {
        // @ts-ignore
        text.providers.bootstrapKubeadm.enabled = true;
        // @ts-ignore
        text.providers.bootstrapKubeadm.enableAutomaticUpdate = true;

        // @ts-ignore
        text.providers.controlplaneKubeadm.enabled = true;
        // @ts-ignore
        text.providers.controlplaneKubeadm.enableAutomaticUpdate = true;

        // @ts-ignore
        text.providers.infrastructureDocker.enabled = true;
        // @ts-ignore
        text.providers.infrastructureDocker.enableAutomaticUpdate = true;

        // @ts-ignore
        text.providers.infrastructureGCP.enabled = true;
        // @ts-ignore
        text.providers.infrastructureGCP.enableAutomaticUpdate = true;
        // @ts-ignore
        text.providers.infrastructureGCP.variables.GCP_B64ENCODED_CREDENTIALS = '';

        // @ts-ignore
        text.providers.infrastructureAzure.enabled = true;
        // @ts-ignore
        text.providers.infrastructureAzure.enableAutomaticUpdate = true;

        // @ts-ignore
        text.providers.infrastructureAWS.enabled = true;
        // @ts-ignore
        text.providers.infrastructureAWS.enableAutomaticUpdate = true;
      }

      let turtlesProvidersChartVersion = providersChartNeedsStgRegistry() && isRancherManagerVersion('2.14') ? '0.26' : providersChartNeedsStgRegistry() && isRancherManagerVersion('2.15') ? '0.27' : undefined
      // Install Rancher Turtles Certified Providers chart
      cy.checkChart('local', 'Install', vars.turtlesProvidersChartName, turtlesNamespace, {
        version: turtlesProvidersChartVersion,
        modifyYAMLOperation: providerSelectionFunction
      });
    })
    );

    qase(441, it('Add CAPD Kubeadm ClusterClass Fleet Repo', () => {
      cy.addFleetGitRepo(clusterClassRepoName, vars.turtlesRepoUrl, vars.classBranch, classesPath, vars.capiClassesNS)
      // Go to CAPI > ClusterClass to ensure the clusterclass is created
      cy.checkCAPIClusterClass(classNamePrefix);
    })
    );
  })

  context('[CLUSTER-IMPORT]', () => {
    qase(6,
      it('Import CAPD Kubeadm class-clusters using YAML', () => {
        cy.readFile(classClusterFileName).then((data) => {
          data = data.replace(/replace_cluster_name/g, clusterName)
          data = data.replace(/replace_kindVersion/g, vars.kindVersion)
          cy.importYAML(data, vars.capiClustersNS)
        });

        // Check CAPI cluster using its name
        cy.checkCAPICluster(clusterName);

        // Check CAPI cluster status
        cy.checkCAPIClusterCPInitialized(clusterName);
      })
    );

    qase(6,
      it('Apply Calico CNI manifest', () => {
        cy.kubectlExecute([getCAPIClusterKubeconfig(clusterName), applyYAMLManifest(clusterName, vars.calicoCNIYaml)], 5000);
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

    qase(95,
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
          capiClusterDeletion(clusterName, timeout);
      })
      );

      qase(450, it('Delete the ClusterClass fleet repo', () => {
        // Remove the clusterclass repo
        cy.removeFleetGitRepo(clusterClassRepoName);
      })
      );
    }
  })
});
