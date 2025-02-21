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
Cypress.Commands.add('accesMenuSelection', (firstAccessMenu, secondAccessMenu) => {
  cypressLib.accesMenu(firstAccessMenu);
  cypressLib.accesMenu(secondAccessMenu);
});

// Command to set CAPI Auto-import on default namespace
Cypress.Commands.add('namespaceAutoImport', (mode) => {
  cy.contains('local')
    .click();
  cypressLib.accesMenu('Projects/Namespaces');
  cy.contains('Create Project')
    .should('be.visible');

  // Select default namespace
  cy.setNamespace('Project: Default');
  cy.setAutoImport(mode);
  cy.namespaceReset();
});

// Command to set CAPI Auto-import from Menu
Cypress.Commands.add('setAutoImport', (mode) => {
  // If the desired mode is already in place, then simply reload the page.
  cy.getBySel('sortable-table-0-action-button').click();
  cy.get('.list-unstyled.menu').then(($list) => {
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
  cy.setNamespace('Not');

  // Create namespace
  cy.contains('Create Namespace').click();
  cy.typeValue('Name', namespace);
  cy.clickButton('Create');
  cy.contains(new RegExp('Active.*' + namespace));
  cy.namespaceReset();
});

// Command to set namespace selection
// TODO(pvala): Could be improved to check if the namespace is already set before changing it
Cypress.Commands.add('setNamespace', (namespace) => {
  cy.getBySel('namespaces-dropdown', { timeout: 18000 }).trigger('click');
  cy.get('.ns-clear').click();
  cy.get('.ns-filter-input').type(namespace + '{enter}{esc}');
});

// Command to reset namespace selection to default 'Only User Namespaces'
Cypress.Commands.add('namespaceReset', () => {
  cy.setNamespace('Only User Namespaces');
});

// Command to create CAPI cluster from Clusterclass (ui-extn: v0.8.2)
Cypress.Commands.add('createCAPICluster', (className, clusterName, machineName, k8sVersion, podCIDR, serviceCIDR) => {
  // Navigate to Classes Menu
  cy.checkCAPIMenu();
  cy.contains('Cluster Classes').click();
  cy.typeInFilter(className);
  cy.contains(className).should('be.visible');
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
  cy.typeValue('Name', 'md-0');
  cy.get('.vs__selected-options').click();
  cy.contains(machineName).click();
  cy.clickButton('Next');
  cy.clickButton('Create');
});

// Command to check CAPI cluster Active status
Cypress.Commands.add('checkCAPIClusterActive', (clusterName) => {
  cy.checkCAPIMenu();
  cy.contains(new RegExp('Provisioned.*' + clusterName), { timeout: 90000 });
  cy.contains('Machine Deployments').click();
  cy.contains(new RegExp('Running.*' + clusterName), { timeout: 90000 });
  cy.contains('Machine Sets').click();
  cy.contains(new RegExp('Active.*' + clusterName), { timeout: 90000 });
});

// Command to check CAPI cluster Provisioned status
Cypress.Commands.add('checkCAPIClusterProvisioned', (clusterName) => {
  cy.checkCAPIMenu();
  cy.contains(new RegExp('Provisioned.*' + clusterName), { timeout: 90000 });
});

// Command to check CAPI cluster deletion status
Cypress.Commands.add('checkCAPIClusterDeleted', (clusterName, timeout) => {
  cy.checkCAPIMenu();
  cy.getBySel('button-group-child-1').click();
  cy.typeInFilter(clusterName);
  cy.getBySel('sortable-table-0-action-button', { timeout: timeout }).should('not.exist');
});

// Command to check CAPI Menu is visible
Cypress.Commands.add('checkCAPIMenu', () => {
  cy.goToHome();
  cypressLib.burgerMenuToggle();
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
  cy.typeValue('Version', version);
  cy.typeValue('URL', url);
  cy.clickButton('Create');
  cy.contains('Providers').should('be.visible');
});

// Command to add CAPI Infrastructure provider
Cypress.Commands.add('addInfraProvider', (providerType, name, namespace, cloudCredentials) => {
  // Navigate to providers Menu
  cy.checkCAPIMenu();
  cy.contains('Providers').click();
  cy.clickButton('Create');
  var selector = 'select-icon-grid-' + providerType
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
Cypress.Commands.add('removeCAPIResource', (resourcetype, resourceName) => {
  // Navigate to CAPI Menu
  cy.checkCAPIMenu();
  cy.contains(resourcetype).click();
  cy.viewport(1920, 1080);
  cy.typeInFilter(resourceName);
  cy.contains(resourceName).should('be.visible');
  cy.getBySel('sortable-table_check_select_all').click();
  cy.getBySel('sortable-table-promptRemove').click();
  cy.getBySel('prompt-remove-confirm-button').click();
  cy.reload();
  cy.contains(resourcetype).should('be.visible').click();
  cy.contains(resourceName).should('not.exist');
});

// Command to add AWS Cloud Credentials
Cypress.Commands.add('addCloudCredsAWS', (name, accessKey, secretKey) => {
  cy.accesMenuSelection('Cluster Management', 'Cloud Credentials');
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
  cy.accesMenuSelection('Cluster Management', 'Cloud Credentials');
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
  cy.accesMenuSelection('Cluster Management', 'Cloud Credentials');
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
  cy.accesMenuSelection('Cluster Management', 'Cloud Credentials');
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

// Command to Install or Update App from Charts menu
// Operation types: Install, Update
// You can optionally provide an array of questions and answer them before the installation starts
// Example1: cy.checkChart('Alerting', 'default', [{ menuEntry: '(None)', checkbox: 'Enable Microsoft Teams' }]);
// Example2: cy.checkChart('Rancher Turtles', 'rancher-turtles-system', [{ menuEntry: 'Rancher Turtles Features Settings', checkbox: 'Seamless integration with Fleet and CAPI'},{ menuEntry: 'Rancher webhook cleanup settings', inputBoxTitle: 'Webhook Cleanup Image', inputBoxValue: 'registry.k8s.io/kubernetes/kubectl:v1.28.0'}]);
Cypress.Commands.add('checkChart', (operation, chartName, namespace, version, questions) => {
  cy.get('.nav').contains('Apps').click();
  cy.contains('Featured Charts').should('be.visible');
  cy.contains(chartName, { timeout: 60000 }).click();
  cy.contains('Charts: ' + chartName);

  if (version != undefined && version != "") {
    cy.contains(version).click();
    cy.url().should("contain", version)
  }
  cy.clickButton(operation);
  // During update, Chart name changes to App name
  if (operation == "Install") {
    cy.contains('.outer-container > .header', chartName);
  }
  cy.clickButton('Next');

  // Used for entering questions and answering them
  if (questions != undefined) {
    // Some apps like Alerting show questions page directly so no further action needed here
    // Some other apps like Turtles have a 'Customize install settings' checkbox or its variant which needs to be clicked
    if (chartName == 'Rancher Turtles' && operation == "Install") {
      cy.contains('Customize install settings').should('be.visible').click();
    }

    questions.forEach((question: { menuEntry: string; checkbox: string; inputBoxTitle: string; inputBoxValue: string; }) => {
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

  // Close the shell to avoid conflict
  cy.get('.closer').click();

  // Select app namespace
  cy.setNamespace(namespace);

  // Resource should be deployed (green badge)
  cy.get('.outlet').contains('Deployed', { timeout: 180000 });
  cy.namespaceReset();
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
Cypress.Commands.add('deleteCluster', (clusterName) => {
  cy.searchCluster(clusterName);
  cy.viewport(1920, 1080);
  cy.getBySel('sortable-table_check_select_all').click();
  cy.clickButton('Delete');
  cy.getBySel('prompt-remove-input')
    .type(clusterName);
  cy.getBySel('prompt-remove-confirm-button').click();
  cy.contains(clusterName).should('not.exist');
});

// Command to remove CAPI cluster
Cypress.Commands.add('deleteCAPICluster', (clusterName, timeout) => {
  // Navigate to Cluster Menu
  cy.checkCAPIMenu();
  cy.getBySel('button-group-child-1').click();
  cy.viewport(1920, 1080);
  cy.typeInFilter(clusterName);
  cy.getBySel('sortable-table_check_select_all').click();
  cy.clickButton('Delete');
  cy.getBySel('prompt-remove-confirm-button').click();
  cy.contains(clusterName, { timeout: timeout }).should('not.exist');
});

// Command to remove CAPI clusterclass
Cypress.Commands.add('deleteCAPIClusterClass', (className) => {
  // Navigate to Cluster Menu
  cy.checkCAPIMenu();
  cy.contains('Cluster Classes').click();
  cy.getBySel('button-group-child-1').click();
  cy.viewport(1920, 1080);
  cy.typeInFilter(className);
  cy.getBySel('sortable-table_check_select_all').click();
  cy.clickButton('Delete');
  cy.getBySel('prompt-remove-confirm-button').click();
  cy.contains(className).should('not.exist');
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
Cypress.Commands.add('addFleetGitRepo', (repoName, repoUrl, branch, path, workspace) => {
  cy.accesMenuSelection('Continuous Delivery', 'Git Repos');
  cy.contains('fleet-').click();
  if (!workspace) {
    workspace = 'fleet-local';
  }
  cy.contains(workspace).should('be.visible').click();
  cy.clickButton('Add Repository');
  cy.contains('Git Repo:').should('be.visible');
  cy.typeValue('Name', repoName);
  cy.typeValue('Repository URL', repoUrl);
  cy.typeValue('Branch Name', branch);
  cy.clickButton('Add Path');
  cy.getBySel('gitRepo-paths').within(($gitRepoPaths) => {
    cy.getBySel('input-0').type(path);
  })
  cy.clickButton('Next');
  cy.get('button.btn').contains('Previous').should('be.visible');
  cy.clickButton('Create');

  // Navigate to fleet repo
  cypressLib.burgerMenuToggle();
  cy.checkFleetGitRepo(repoName, workspace); // Wait until the repo details are loaded
})

// Command remove Fleet Git Repository
Cypress.Commands.add('removeFleetGitRepo', (repoName, noRepoCheck, workspace) => {
  cy.checkFleetGitRepo(repoName, workspace);
  // Click on the actions menu and select 'Delete' from the menu
  cy.get('.actions .btn.actions').click();
  cy.get('.icon.group-icon.icon-trash').click();
  cypressLib.confirmDelete();
  if (noRepoCheck == true) {
    cy.contains(repoName).should('not.exist');
  } else {
    cy.contains('No repositories have been added').should('be.visible');
  }
})

// Command forcefully update Fleet Git Repository
Cypress.Commands.add('forceUpdateFleetGitRepo', (repoName, workspace) => {
  cy.checkFleetGitRepo(repoName, workspace);
  // Click on the actions menu and select 'Delete' from the menu
  cy.get('.actions .btn.actions').click();
  cy.get('.icon.group-icon.icon-refresh').click();
})

// Command forcefully update Fleet Git Repository
Cypress.Commands.add('checkFleetGitRepo', (repoName, workspace) => {
  // Go to 'Continuous Delivery' > 'Git Repos'
  cy.accesMenuSelection('Continuous Delivery', 'Git Repos');
  // Change the workspace using the dropdown on the top bar
  cy.contains('fleet-').click();
  if (!workspace) {
    workspace = 'fleet-local';
  }
  cy.contains(workspace).click();
  // Click the repo link
  cy.contains(repoName).click();
  cy.url().should("include", "fleet/fleet.cattle.io.gitrepo/" + workspace + "/" + repoName)
})

// Fleet namespace toggle
Cypress.Commands.add('fleetNamespaceToggle', (toggleOption='local') => {
  cy.contains('fleet-').click();
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
