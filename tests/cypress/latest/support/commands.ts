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

// In this file you can write your custom commands and overwrite existing commands.

import 'cypress-file-upload';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import jsyaml from 'js-yaml';
import _ from 'lodash';

// Generic commands
// Go to specific Sub Menu from Access Menu
Cypress.Commands.add('accesMenuSelection', (menuPaths: string[]) => {
  menuPaths.forEach((path) => {
    cy.wait(1000);
    cypressLib.accesMenu(path);
  })
});

// Command to set CAPI Auto-import on capi-clusters namespace
Cypress.Commands.add('namespaceAutoImport', (mode) => {
  cy.contains('local')
    .click();
  cypressLib.accesMenu('Projects/Namespaces');
  cy.contains('Create Project')
    .should('be.visible');

  // Select capi-clusters namespace
  cy.setNamespace('capi-clusters');
  cy.setAutoImport(mode);
  cy.namespaceReset();
});

// Command to set CAPI Auto-import from Menu
Cypress.Commands.add('setAutoImport', (mode) => {
  // If the desired mode is already in place, then simply reload the page.
  cy.getBySel('sortable-table-0-action-button').click();

  const dropdownLabel = '.popperContainer'
  cy.get(dropdownLabel).then(($list) => {
    if ($list.text().includes(mode + ' CAPI Auto-Import')) {
      cy.contains(mode + ' CAPI Auto-Import').click();
    } else {
      // Workaround to close the dropdown menu
      cy.reload();
    }
  })
});

// Command to set Auto-import on CAPI cluster
Cypress.Commands.add('clusterAutoImport', (clusterName, mode) => {
  // Navigate to Cluster Menu
  cy.checkCAPIMenu();
  cy.getBySel('button-group-child-1').click();
  cy.typeInFilter(clusterName);
  cy.setAutoImport(mode);
});

// Command to create namespace
Cypress.Commands.add('createNamespace', (namespace) => {
  cy.contains('local')
    .click();
  cypressLib.accesMenu('Projects/Namespaces');
  cy.setNamespace('Not', 'all_orphans');

  // Create namespace
  cy.contains('Create Namespace').click();
  cy.typeValue('Name', namespace);
  cy.clickButton('Create');
  cy.contains(new RegExp('Active.*' + namespace));
  cy.namespaceReset();
});

// Command to set namespace selection
Cypress.Commands.add('setNamespace', (namespace, namespaceID) => {
  const nsID: string = namespaceID || (namespace.startsWith('Project:')) ? '' : `ns_${namespace}`
  cy.getBySel('namespaces-dropdown', { timeout: 18000 }).trigger('click');
  cy.get('.ns-clear').click();
  cy.get('.ns-options').within(() => {
    if (nsID != '') {
      cy.get(`div[id='${nsID}']`).click();
    } else {
      cy.contains('.ns-option', namespace).click();
    }
  });
  cy.get('.ns-filter-input').type('{esc}');
  cy.get('.ns-values').should('contain.text', namespace);
});

// Command to reset namespace selection to default 'Only User Namespaces'
Cypress.Commands.add('namespaceReset', () => {
  cy.setNamespace('Only User Namespaces', 'all_user');
});

// Command to create CAPI cluster from Clusterclass (ui-extn: v0.8.2)
Cypress.Commands.add('createCAPICluster', (className, clusterName, machines, k8sVersion, podCIDR, serviceCIDR, extraVariables) => {
  // Navigate to Classes Menu
  cy.checkCAPIClusterClass(className);
  cy.getBySel('sortable-table-0-action-button').click();

  // Create Cluster from Classes Menu
  cy.contains('Create Cluster').click();
  cy.contains('Cluster: Create').should('be.visible');
  cy.typeValue('Cluster Name', clusterName);
  cy.typeValue('Kubernetes Version', k8sVersion);

  // Networking details, Workaround for capi-ui-extension/issues/123
  cy.typeValue('Service Domain', 'cluster.local');
  cy.getBySel('remove-item-0').click();
  cy.getBySel('array-list-button').click({ multiple: true });
  const inputID = ' > :nth-child(1) > [data-testid="array-list-box0"] > '

  // podCIDR details
  cy.get(':nth-child(1)' + inputID + '.value > .labeled-input').type(podCIDR);
  // serviceCIDR details
  if (serviceCIDR != undefined) {
    cy.get(':nth-child(2)' + inputID + '.value > .labeled-input').type(serviceCIDR);
  } else {
    cy.get(':nth-child(2)' + inputID + '.remove').click();
  }

  // Machine Deployment/Pool details
  Object.entries(machines).forEach(([key, value], index, array) => {
    cy.get('h2').contains('Workers').parents('div.block').within(() => {
      cy.getBySel(`array-list-box${index}`).within(() => {
        cy.typeValue('Name', key);
        cy.get('.vs__selected-options').click();
      })
    })
    // The options list is located somewhere outside the <body> block; so it needs to be called outside the above block.
    cy.contains(value).click();
    // Ensure there are more entries to be made before clicking the `Add` button.
    const isLast = index === array.length - 1;
    if (!isLast) {
      cy.get('h2').contains('Workers').parents('div.block').within(() => {
        cy.clickButton('Add');
      })
    }
  })

  cy.clickButton('Next');

  if (extraVariables) {
    extraVariables.forEach((variable) => {
      if (variable.type == "string") {
        cy.typeValue(variable.name, variable.value);
      }
      if (variable.type == 'dropdown') {
        cy.get(`div[title=${variable.name}]`).click();
        cy.contains(variable.value).click();
      }
    })
  }
  cy.clickButton('Create');
  // Add a check to ensure there are no errors
  cy.wait(3000)
  cy.get('div[id=cru-errors]').should('not.exist');
});


// Command to check CAPI cluster presence under CAPI Menu
Cypress.Commands.add('checkCAPICluster', (clusterName) => {
  cy.checkCAPIMenu();
  cy.getBySel('button-group-child-1').click();
  cy.typeInFilter(clusterName);
  cy.getBySel('sortable-cell-0-1', { timeout: 90000 }).should('exist');
});

// Command to check CAPI cluster presence under CAPI Menu
Cypress.Commands.add('checkCAPIClusterClass', (className) => {
  cy.checkCAPIMenu();
  cy.contains('Cluster Classes').click();
  cy.getBySel('button-group-child-1').click();
  cy.typeInFilter(className);
  cy.waitForAllRowsInState('Active');
});

// Command to check CAPI cluster Active status
Cypress.Commands.add('checkCAPIClusterActive', (clusterName, timeout = 90000) => {
  cy.checkCAPIMenu();
  cy.contains(new RegExp('Provisioned.*' + clusterName), { timeout: timeout });
  cy.contains('Machine Deployments').click();
  cy.contains(new RegExp('Running.*' + clusterName), { timeout: timeout });
  cy.contains('Machine Sets').click();
  cy.contains(new RegExp('Active.*' + clusterName), { timeout: timeout });
});

// Command to check CAPI cluster Provisioned status
Cypress.Commands.add('checkCAPIClusterProvisioned', (clusterName, timeout) => {
  cy.checkCAPIMenu();
  cy.getBySel('button-group-child-1').click();
  cy.typeInFilter(clusterName);
  if (timeout != undefined) {
    timeout = timeout
  } else {
    timeout = 90000
  }
  cy.contains(new RegExp('Provisioned.*' + clusterName), { timeout: timeout });
});

// Command to check CAPI cluster deletion status
Cypress.Commands.add('checkCAPIClusterDeleted', (clusterName, timeout) => {
  cy.checkCAPIMenu();
  cy.getBySel('button-group-child-1').click();
  cy.typeInFilter(clusterName);
  cy.getBySel('sortable-cell-0-1', { timeout: timeout }).should('not.exist');
});

// Command to check CAPI Menu is visible
Cypress.Commands.add('checkCAPIMenu', () => {
  cy.goToHome();
  cy.burgerMenuOperate('open');
  cypressLib.accesMenu('Cluster Management');
  cy.get('.header').contains('CAPI').click();
  cy.wait(2000);
  cy.contains('.nav', 'Clusters')
  cy.contains('.nav', 'Machine Deployments')
  cy.contains('.nav', 'Machine Sets')
  cy.contains('.nav', 'Cluster Classes')
  cy.contains('.nav', 'Providers')
});

// Command to add CAPI Custom provider
Cypress.Commands.add('addCustomProvider', (name, namespace, providerName, providerType, version, url) => {
  // Navigate to providers Menu
  cy.checkCAPIMenu();
  cy.contains('Providers').click();
  cy.clickButton('Create');
  cy.contains('Custom').click();

  // Select provider type
  cy.contains('Provider type').click();
  cy.contains(providerType, { matchCase: false }).click();

  cy.getBySel('name-ns-description-namespace').type(namespace + '{enter}');
  cy.typeValue('Name', name);
  cy.typeValue('Provider', providerName);
  if (version != undefined) {
    cy.typeValue('Version', version);
  }
  if (url != undefined) {
    cy.typeValue('URL', url);
  }
  cy.clickButton('Create');
  cy.contains('Providers').should('be.visible');
});

// Command to add CAPI Infrastructure provider
Cypress.Commands.add('addInfraProvider', (providerType, name, namespace, cloudCredentials) => {
  // Navigate to providers Menu
  cy.checkCAPIMenu();
  cy.contains('Providers').click();
  cy.clickButton('Create');
  const selector = 'select-icon-grid-' + providerType
  cy.getBySel(selector).click();
  cy.contains('Provider: Create ' + providerType, { matchCase: false }).should('be.visible');

  // TODO: Add variables support after capi-ui-extension/issues/49
  cy.getBySel('name-ns-description-namespace').type(namespace + '{enter}');
  cy.typeValue('Name', name);

  // Select Cloud credentials name
  if (providerType != 'Docker') {
    cy.getBySel('cluster-prov-select-credential').trigger('click');
    cy.contains(cloudCredentials).click();
  }
  cy.clickButton('Create');
  cy.contains('Providers').should('be.visible');
});

// Command to delete CAPI resource
Cypress.Commands.add('removeCAPIResource', (resourcetype, resourceName, timeout) => {
  // Navigate to CAPI Menu
  cy.checkCAPIMenu();
  if (resourcetype != 'Clusters') {
    cy.contains(resourcetype).click();
  }
  cy.getBySel('button-group-child-1').click();
  cy.typeInFilter(resourceName);
  cy.getBySel('sortable-cell-0-1').should('exist');
  cy.viewport(1920, 1080);
  cy.getBySel('sortable-table_check_select_all').click();
  cy.getBySel('sortable-table-promptRemove').click();
  cy.getBySel('prompt-remove-confirm-button').click();
  cy.typeInFilter(resourceName);
  if (timeout != undefined) {
    cy.getBySel('sortable-cell-0-1', { timeout: timeout }).should('not.exist');
  } else {
    cy.getBySel('sortable-cell-0-1').should('not.exist');
  }
});

// Command to add AWS Cloud Credentials
Cypress.Commands.add('addCloudCredsAWS', (name, accessKey, secretKey) => {
  cy.accesMenuSelection(['Cluster Management', 'Cloud Credentials']);
  cy.contains('API Key').should('be.visible');
  cy.clickButton('Create');
  cy.getBySel('subtype-banner-item-aws').click();
  cy.typeValue('Credential Name', name);
  cy.typeValue('Access Key', accessKey);
  cy.typeValue('Secret Key', secretKey, false, false);
  cy.clickButton('Create');
  cy.contains('API Key').should('be.visible');
  cy.contains(name).should('be.visible');
});

// Command to add GCP Cloud Credentials
Cypress.Commands.add('addCloudCredsGCP', (name, gcpCredentials) => {
  cy.accesMenuSelection(['Cluster Management', 'Cloud Credentials']);
  cy.contains('API Key').should('be.visible');
  cy.clickButton('Create');
  cy.getBySel('subtype-banner-item-gcp').click();
  cy.typeValue('Credential Name', name);
  cy.getBySel('text-area-auto-grow').type(gcpCredentials, { log: false });
  cy.clickButton('Create');
  cy.contains('API Key').should('be.visible');
  cy.contains(name).should('be.visible');
});

// Command to add Azure Cloud Credentials
Cypress.Commands.add('addCloudCredsAzure', (name: string, clientID: string, clientSecret: string, subscriptionID: string) => {
  cy.accesMenuSelection(['Cluster Management', 'Cloud Credentials']);
  cy.contains('API Key').should('be.visible');
  cy.clickButton('Create');
  cy.getBySel('subtype-banner-item-azure').click();
  cy.typeValue('Credential Name', name);
  cy.typeValue('Client ID', clientID);
  cy.typeValue('Client Secret', clientSecret, false, false);
  cy.typeValue('Subscription ID', subscriptionID);
  cy.clickButton('Create');
  cy.contains('API Key').should('be.visible');
  cy.contains(name).should('be.visible');
});

// Command to add VMware vsphere Cloud Credentials
Cypress.Commands.add('addCloudCredsVMware', (name: string, vsphere_username: string, vsphere_password: string, vsphere_server: string, vsphere_server_port: string) => {
  cy.accesMenuSelection(['Cluster Management', 'Cloud Credentials']);
  cy.contains('API Key').should('be.visible');
  cy.clickButton('Create');
  cy.getBySel('subtype-banner-item-vmwarevsphere').click();
  cy.typeValue('Credential Name', name);
  cy.typeValue('vCenter or ESXi Server', vsphere_server);
  cy.typeValue('Port', vsphere_server_port);
  cy.typeValue('Username', vsphere_username);
  cy.typeValue('Password', vsphere_password, false, false);
  cy.clickButton('Create');
  cy.contains('API Key').should('be.visible');
  cy.contains(name).should('be.visible');
});

Cypress.Commands.add('addRepository', (repositoryName: string, repositoryURL: string, repositoryType: string, repositoryBranch: string) => {
  cy.contains('local')
    .click();
  cy.clickNavMenu(['Apps', 'Repositories'])
  // Make sure we are in the 'Repositories' screen (test failed here before)
  // Test fails sporadically here, screen stays in pending state forever
  // Ensuring "Loading..." overlay screen is not present.
  cy.contains('Loading...', { timeout: 35000 }).should('not.exist');
  cy.contains('header', 'Repositories')
    .should('be.visible');
  cy.contains('Create')
    .should('be.visible');

  cy.clickButton('Create');
  cy.contains('Repository: Create')
    .should('be.visible');
  cy.typeValue('Name', repositoryName);
  if (repositoryType === 'git') {
    cy.contains('Git repository')
      .click();
    cy.typeValue('Git Repo URL', repositoryURL);
    cy.typeValue('Git Branch', repositoryBranch);
  } else {
    cy.typeValue('Index URL', repositoryURL);
  }
  cy.clickButton('Create');
  // Make sure the repo is active before leaving
  // Always press Refresh button as workaround for https://github.com/rancher/rancher/issues/49671
  cy.wait(1000);
  cy.typeInFilter(repositoryName);
  cy.getBySel('sortable-table-0-action-button').click();
  cy.wait(1000);
  cy.get('.icon.group-icon.icon-refresh').click();
  cy.wait(1000);
  cy.contains(new RegExp('Active.*' + repositoryName), { timeout: 150000 });
});

// Command to Install, Update or Upgrade App from Charts menu
// Operation types: Install, Update, Upgrade
// You can optionally provide an array of questions and answer them before the installation starts
// Example1: cy.checkChart('Alerting', 'default', [{ menuEntry: '(None)', checkbox: 'Enable Microsoft Teams' }]);
// Example2: cy.checkChart('Rancher Turtles', 'rancher-turtles-system', [{ menuEntry: 'Rancher Turtles Features Settings', checkbox: 'Seamless integration with Fleet and CAPI'},{ menuEntry: 'Rancher webhook cleanup settings', inputBoxTitle: 'Webhook Cleanup Image', inputBoxValue: 'registry.k8s.io/kubernetes/kubectl:v1.28.0'}]);
Cypress.Commands.add('checkChart', (operation, chartName, namespace, version, questions, refreshRepo = false) => {
  cy.get('.nav').contains('Apps').click();

  // Select All Repositries and click Action/Refresh
  cy.get('.nav').contains('Repositories').click();
  cy.waitForAllRowsInState('Active');
  cy.wait(500);
  if (refreshRepo && refreshRepo == true) {
    cy.get('div.checkbox-outer-container.check').click();
    cy.wait(500);
    cy.contains('Refresh').click();
    cy.waitForAllRowsInState('Active');
    cy.wait(1000);
  }

  cy.get('.nav').contains('Charts').click();
  cy.contains('Featured Charts').should('be.visible');

  const findChart = (retries = 10) => {
    cy.typeInFilter(chartName);
    cy.getBySel('chart-selection-grid').within(() => {
      cy.contains(chartName, { timeout: 10000 }).then($el => {
        if ($el.length) {
          // Chart found, proceed with click
          cy.wrap($el).click();
        } else if (retries > 0) {
          // Chart not found, refresh and try again
          cy.get('.icon.icon-lg.icon-refresh').click();
          cy.get('.icon.icon-lg.icon-checkmark', { timeout: 60000 }).should('be.visible');
          findChart(retries - 1);
        } else {
          // Max attempts reached, fail the test
          throw new Error(`Chart ${chartName} not found`);
        }
      });
    })
    cy.contains('Charts: ' + chartName);
  };
  findChart();

  if (version && version != "") {
    cy.contains(version).click();
    cy.url().should("contain", version)
  }

  if (chartName == 'Rancher Turtles' && operation == 'Update') {
    cy.get('body').invoke('text').then((bodyText) => {
      if (bodyText.includes('Current')) {
        cy.contains('Current').click();
      }
    });
  }

  cy.getBySel('btn-chart-install').click();
  cy.contains(operation + ': Step 1')
  cy.clickButton('Next');

  // Used for entering questions and answering them
  if (questions) {
    // Some apps like Alerting show questions page directly so no further action needed here
    // Some other apps like Turtles have a 'Customize install settings' checkbox or its variant which needs to be clicked
    if (chartName == 'Rancher Turtles' && operation == "Update") {
      cy.contains('Customize install settings').should('be.visible').click();
    }

    questions.forEach((question) => {
      if (question.checkbox) {
        cy.contains('a', question.menuEntry).click();
        cy.contains(question.checkbox).click(); // TODO make sure the checkbox is enabled
      } else if (question.inputBoxTitle && question.inputBoxValue) {
        cy.contains(question.menuEntry).click();
        cy.contains(question.inputBoxTitle).siblings('input').clear().type(question.inputBoxValue);
      }
    });
  }

  cy.clickButton(operation);

  // Close the shell when installing Turtles as rancher is getting restarted
  if (chartName == 'Rancher Turtles') {
    cy.get('.closer').click();
  } else {
    // Wait for both CRD and main helm chart to be installed
    cy.contains(new RegExp('SUCCESS: helm .*crd.*tgz.*SUCCESS: helm .*tgz'), { timeout: 240000 }).should('be.visible');
    cy.get('.closer').click();
  }

  // Rancher pod restarts during Turtles installation
  // Poll /dashboard/about until it returns HTTP 200 and then reload the page
  if (chartName == 'Rancher Turtles') {
    cy.wait(7000); // Should be enough time to start restarting Rancher
    const checkApiStatus = (retries = 20) => {
      cy.request({
        url: '/about',
        failOnStatusCode: false,
        timeout: 30000,
      }).then((response) => {
        if (response.status !== 200 && retries > 0) {
          cy.wait(5000);
          checkApiStatus(retries - 1);
        } else {
          expect(response.status).to.eq(200);
          // Once /dashboard/about is back, reload the page
          cy.wait(5000);
          cy.reload();
        }
      });
    };
    checkApiStatus();
  }

  if (operation == 'Install') {
    // All resources (usually an App and its CRD) in the namespaces are deployed (green badge)
    cy.contains('Installed Apps').should('be.visible');
    cy.setNamespace(namespace);
    cy.waitForAllRowsInState('Deployed', 180000);
    cy.namespaceReset();
  } else {
    cy.contains(new RegExp('Installed App:.*Deployed'), { timeout: 120000 }).should('be.visible');
    cy.waitForAllRowsInState('Active');
  }
});

// Command for patching generic YAML resources
Cypress.Commands.add('patchYamlResource', (clusterName, namespace, resourceKind, resourceName, patch) => {
  // With support for nested objects, but "isNestedIn" flag must be set to true (the flag will be removed from the YAML)
  // Patch example: const patch = {data: {manifests: {isNestedIn: true, spec: {...}}};

  // Locate the resource and initiate Edit YAML mode
  cypressLib.accesMenu(clusterName);
  cy.setNamespace(namespace);
  // Open Resource Search modal
  cy.get('.icon-search.icon-lg').click();
  cy.get('input.search').type(resourceKind);
  cy.contains('a', resourceKind, { matchCase: false }).click();
  cy.typeInFilter(resourceName);
  // Click three dots menu on filtered resource (must be unique)
  cy.getBySel('sortable-table-0-action-button').click();
  //cy.get('.btn.actions.role-multi-action').click();
  cy.contains('Edit YAML').click();

  // Do the CodeMirror magic here
  cy.get('.CodeMirror').then((editor) => {
    // @ts-expect-error known error with CodeMirror
    const yaml = editor[0].CodeMirror.getValue();
    const yamlObject = jsyaml.load(yaml);

    function applyPatch(yamlObj, patchObj) {
      Object.keys(patchObj).forEach(key => {
        if (patchObj[key].isNestedIn) {
          // If the patch is for a nested object merge the original and patched objects
          const originalValue = _.get(yamlObj, key);
          let nestedObject = {};
          if (originalValue) {
            nestedObject = jsyaml.load(originalValue);
          }
          const patchedNestedObject = _.merge(nestedObject, _.omit(patchObj[key], 'isNestedIn'));
          _.set(yamlObj, key, jsyaml.dump(patchedNestedObject));
        } else if (typeof patchObj[key] === 'object' && !Array.isArray(patchObj[key])) {
          // If the patch is for an object, recursively apply the patch
          if (!yamlObj[key]) {
            yamlObj[key] = {};
          }
          applyPatch(yamlObj[key], patchObj[key]);
        } else {
          // If the patch is for a value, simply set the value in the YAML object
          _.set(yamlObj, key, patchObj[key]);
        }
      });
    }

    applyPatch(yamlObject, patch);

    const patchedYaml = jsyaml.dump(yamlObject);
    // Set the modified YAML back to the editor
    // @ts-expect-error known error with CodeMirror
    editor[0].CodeMirror.setValue(patchedYaml);
    cy.clickButton('Save');
  });

  // Reset the namespace after the operation
  cy.namespaceReset();
});

// Command to search cluster in cluster-list
Cypress.Commands.add('searchCluster', (clusterName) => {
  cy.goToHome();
  cy.clickButton('Manage');
  cy.getBySel('cluster-list').should('be.visible');
  cy.typeInFilter(clusterName);
});

// Command to remove cluster from Rancher
Cypress.Commands.add('deleteCluster', (clusterName, timeout = 120000) => {
  cy.searchCluster(clusterName);
  cy.viewport(1920, 1080);
  cy.getBySel('sortable-table_check_select_all').click();
  cy.clickButton('Delete');
  cy.getBySel('prompt-remove-input')
    .type(clusterName);
  cy.getBySel('prompt-remove-confirm-button').click();
  cy.contains(clusterName, { timeout: timeout }).should('not.exist');
});

// Command to type in Filter input
Cypress.Commands.add('typeInFilter', (text) => {
  cy.get('.input-sm')
    .click()
    .clear()
    .type(text)
    .wait(2000);
});

// Command to navigate to Home page
Cypress.Commands.add('goToHome', () => {
  cy.visit('/');
  cy.getBySel('banner-title').contains('Welcome to Rancher');
});

// Fleet commands
// Command add Fleet Git Repository
Cypress.Commands.add('addFleetGitRepo', (repoName, repoUrl, branch, paths, targetNamespace, workspace) => {
  cy.accesMenuSelection(['Continuous Delivery', 'Git Repos']);
  cy.getBySel('masthead-create').should('be.visible');
  cy.getBySel('workspace-switcher').click();
  if (!workspace) {
    workspace = 'fleet-local';
  }
  cy.contains(workspace).should('be.visible').click();
  cy.clickButton('Add Repository');
  cy.contains('Git Repo:').should('be.visible');
  cy.typeValue('Name', repoName);
  cy.clickButton("Next");
  cy.get('button.btn').contains('Previous').should('be.visible');

  cy.typeValue('Repository URL', repoUrl);
  cy.typeValue('Branch Name', branch);
  const pathsArray = Array.isArray(paths) ? paths : [paths];
  pathsArray.forEach((path, index) => {
    cy.clickButton('Add Path');
    cy.getBySel('gitRepo-paths').within(() => {
      cy.getBySel('input-' + index).type(path);
    })
  })
  cy.clickButton('Next');
  cy.get('button.btn').contains('Previous').should('be.visible');

  if (targetNamespace) {
    cy.typeValue('Target Namespace', targetNamespace);
  }
  cy.clickButton("Next");
  cy.get('button.btn').contains('Previous').should('be.visible');
  cy.clickButton('Create');

  // Navigate to fleet repo
  cy.checkFleetGitRepo(repoName, workspace); // Wait until the repo details are loaded
})

// Command remove Fleet Git Repository
Cypress.Commands.add('removeFleetGitRepo', (repoName, workspace) => {
  cy.checkFleetGitRepo(repoName, workspace);
  // Click on the actions menu and select 'Delete' from the menu
  cy.get('.actions .btn.actions').click();
  cy.get('.icon.group-icon.icon-trash').click();
  cypressLib.confirmDelete();
  cy.contains(repoName).should('not.exist');
})

// Command forcefully update Fleet Git Repository
Cypress.Commands.add('forceUpdateFleetGitRepo', (repoName, workspace) => {
  cy.checkFleetGitRepo(repoName, workspace);
  // Click on the actions menu and select 'Force Update' from the menu
  cy.get('.actions .btn.actions').click();
  cy.get('.icon.group-icon.icon-refresh').click();
  cy.clickButton('Update')
})

// Command to check Fleet Git Repository
Cypress.Commands.add('checkFleetGitRepo', (repoName, workspace) => {
  // Go to 'Continuous Delivery' > 'Git Repos'
  cy.burgerMenuOperate('open');
  cy.accesMenuSelection(['Continuous Delivery', 'Git Repos']);
  cy.getBySel('masthead-create').should('be.visible');
  // Change the workspace using the dropdown on the top bar
  cy.getBySel('workspace-switcher').click();
  if (!workspace) {
    workspace = 'fleet-local';
  }
  cy.contains(workspace).click();
  // Click the repo link
  cy.contains(repoName).click();
  cy.url().should("include", "fleet/fleet.cattle.io.gitrepo/" + workspace + "/" + repoName)
  // Ensure there are no errors after waiting for a few seconds
  cy.wait(5000);
  cy.get('.badge-state.masthead-state').should("not.contain", "Err Applied");

})

// Fleet namespace toggle
Cypress.Commands.add('fleetNamespaceToggle', (toggleOption = 'local') => {
  cy.getBySel('workspace-switcher').click();
  cy.contains(toggleOption).should('be.visible').click();
});


// Verify textvalues in table giving the row number
// More items can be added with new ".and"
Cypress.Commands.add('verifyTableRow', (rowNumber, expectedText1, expectedText2) => {
  // Adding small wait to give time for things to settle a bit
  // Could not find a better way to wait, but can be improved
  cy.wait(1000)
  // Ensure table is loaded and visible
  cy.contains('tr.main-row[data-testid="sortable-table-0-row"]').should('not.be.empty', { timeout: 25000 });
  cy.get(`table > tbody > tr.main-row[data-testid="sortable-table-${rowNumber}-row"]`, { timeout: 60000 }).should(($row) => {
    // Replace whitespaces by a space and trim the string for both expected texts
    const text = $row.text().replace(/\s+/g, ' ').trim();

    // Check if expectedTextX is a regular expression or a string and perform the assertion
    if (expectedText1) {
      // If expectedText1 is provided, perform the check
      if (expectedText1 instanceof RegExp) {
        expect(text).to.match(expectedText1);
      } else {
        expect(text).to.include(expectedText1);
      }
    }

    if (expectedText2) {
      // If expectedText2 is provided, perform the check
      if (expectedText2 instanceof RegExp) {
        expect(text).to.match(expectedText2);
      } else {
        expect(text).to.include(expectedText2);
      }
    }
  });
});

// Wait until all the rows in the table on current page are in the same State
Cypress.Commands.add('waitForAllRowsInState', (desiredState, timeout = 120000) => {
  cy.get('table > tbody > tr.main-row', { timeout }).should(($rows) => {
    // Make sure there is at least one row
    expect($rows.length).to.be.greaterThan(0);
    const allInDesiredState = $rows.toArray().every((row) => {
      return Cypress.$(row)
        // Look for all Status table cells recognized by "^sortable-cell-.*-0$" attribute
        .find('td[data-testid^="sortable-cell-"][data-testid$="-0"]')
        .text()
        .trim() === desiredState;
    });
    // Assert that all displayed Status cells are in the desired state
    expect(allInDesiredState).to.be.true;
  });
});

Cypress.Commands.add('burgerMenuOperate', (operation: 'open' | 'close') => {
  const isOpen = operation === 'open';
  const selector = isOpen ? 'menu-open' : 'menu-close';
  cy.getBySel('side-menu').then(($el) => {
    if (!$el.hasClass(selector)) {
      cypressLib.burgerMenuToggle();
    };
  });
  cy.get('.side-menu.' + selector).should('exist');
});


Cypress.Commands.add('deleteKubernetesResource', (clusterName = 'local', resourcePath: string[], resourceName: string, namespace?: string) => {
  cy.exploreCluster(clusterName);

  if (namespace) {
    cy.setNamespace(namespace);
  }

  cy.accesMenuSelection(resourcePath);

  cy.typeInFilter(resourceName);
  cy.getBySel('sortable-cell-0-1').should('exist');
  cy.viewport(1920, 1080);
  cy.getBySel('sortable-table_check_select_all').click();
  cy.getBySel('sortable-table-promptRemove').click();
  cy.getBySel('prompt-remove-confirm-button').click();
  cy.typeInFilter(resourceName);
  cy.getBySel('sortable-cell-0-1').should('not.exist');
})

Cypress.Commands.add('exploreCluster', (clusterName: string) => {
  cy.burgerMenuOperate('open');
  cy.accesMenuSelection([clusterName])
  cy.getBySel('header').get('.cluster-name').contains(clusterName);
});

// Create VSphereClusterIdentity
Cypress.Commands.add('createVSphereClusterIdentity', (vsphere_username, vsphere_password) => {
  cy.goToHome();
  cy.burgerMenuOperate('open');
  cy.readFile('./fixtures/vsphere/capv-vsphere-cluster-identity.yaml').then((data) => {
    data = data.replace(/replace_vsphere_username/g, btoa(vsphere_username))
    data = data.replace(/replace_vsphere_password/g, btoa(vsphere_password))
    cy.importYAML(data)
  });
});

// Create AWSClusterStaticIdentity
Cypress.Commands.add('createAWSClusterStaticIdentity', (accessKey, secretKey) => {
  cy.goToHome();
  cy.burgerMenuOperate('open');

  cy.readFile('./fixtures/aws/capa-aws-cluster-identity.yaml').then((data) => {
    data = data.replace(/replace_access_key_id/g, accessKey)
    data = data.replace(/replace_secret_access_key/g, secretKey)
    cy.importYAML(data)
  });
});

// Create CAPIProvider using YAML
Cypress.Commands.add('createCAPIProvider', (providerName) => {
  cy.goToHome();
  cy.burgerMenuOperate('open');
  cy.readFile('./fixtures/' + providerName + '/capi-' + providerName + '-provider.yaml').then((data) => {
    cy.importYAML(data)
  });
});

// Check CAPIProvider ready status
Cypress.Commands.add('checkCAPIProvider', (providerName) => {
  // Navigate to providers Menu
  cy.checkCAPIMenu();
  cy.contains('Providers').click();
  cy.typeInFilter(providerName);
  cy.waitForAllRowsInState('Ready');
});

Cypress.Commands.add('importYAML', (yamlOrPath, namespace, clusterName = 'local') => {
  cy.burgerMenuOperate('open');
  cy.accesMenuSelection([clusterName])
  cy.wait(250);
  cy.get('header').find('button').filter(':has(i.icon-upload)').click();
  cy.get('div.card-container').contains('Import YAML').should('be.visible');

  if (namespace) {
    cy.get('.vs__selected-options').click();
    cy.contains('.vs__dropdown-menu .vs__dropdown-option', namespace).click();
  }

  // Paste file content into the CodeMirror editor
  const setYamlContent = (content: string) => {
    cy.get('.CodeMirror').then((codeMirrorElement) => {
      const cm = (codeMirrorElement[0] as any).CodeMirror;
      cm.setValue(content);
    });
  };

  if (
    typeof yamlOrPath === 'string' &&
    (yamlOrPath.endsWith('.yaml') || yamlOrPath.endsWith('.yml'))
  ) {
    // will read the file and pass it as content argument to setYamlContent
    cy.readFile(yamlOrPath).then(setYamlContent);
  } else {
    // will pass the string directly as content argument to setYamlContent
    setYamlContent(yamlOrPath);
  }

  cy.clickButton('Import');
  cy.get('div.card-container').contains(/Applied \d+ Resource/).should('be.visible');

  cy.clickButton('Close');
});

// Command to verify the count of resources with a given name in a cluster
Cypress.Commands.add('verifyResourceCount', (clusterName, resourcePath, resourceName, namespace, expectedCount, timeout = 480000) => {
  cy.exploreCluster(clusterName);
  cy.accesMenuSelection(resourcePath);
  if (namespace != '') {
    cy.setNamespace(namespace);
  }
  cy.typeInFilter(resourceName);
  cy.get('table > tbody > tr.main-row', { timeout }).should(($rows) => {
    expect($rows.length).to.be.equal(expectedCount);
  });
});

// Command to verify CAPIProvider image registry
Cypress.Commands.add('verifyCAPIProviderImage', (providerName, providerNamespace) => {
  let providerImageRegistry: string;
  if (providerName == 'docker') {
    providerImageRegistry = 'gcr.io/k8s-staging-cluster-api'
  } else {
    providerImageRegistry = 'registry.suse.com/rancher'
  }

  cy.exploreCluster('local');
  cy.accesMenuSelection(['Workloads', 'Deployments']);
  cy.setNamespace(providerNamespace);
  cy.contains(providerImageRegistry).should('be.visible');
});
