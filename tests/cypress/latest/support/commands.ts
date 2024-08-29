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
import jsyaml from 'js-yaml'

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
  cy.getBySel('sortable-table-0-action-button').click();

  // If the desired mode is already in place, then simply reload the page.
  cy.get('.list-unstyled.menu').then(($list) => {
    if ($list.text().includes(mode + ' CAPI Auto-Import')) {
      cy.contains(mode + ' CAPI Auto-Import').click();
    } else {
      // Workaround to close the dropdown menu
      cy.reload();
    }
  })
  cy.namespaceReset();
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
  cy.contains('Active' + ' ' + namespace);
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

// Command to check CAPI cluster Active status
Cypress.Commands.add('checkCAPIClusterActive', (clusterName) => {
  cy.goToHome();
  cypressLib.burgerMenuToggle();
  cy.checkCAPIMenu();
  cy.contains('Provisioned ' + clusterName, { timeout: 90000 });
  cy.contains('Machine Deployments').click();
  cy.contains('Running ' + clusterName, { timeout: 90000 });
  cy.contains('Machine Sets').click();
  cy.contains('Active ' + clusterName, { timeout: 90000 });
});

// Command to check CAPI cluster Provisioned status
Cypress.Commands.add('checkCAPIClusterProvisioned', (clusterName) => {
  cy.goToHome();
  cypressLib.burgerMenuToggle();
  cy.checkCAPIMenu();
  cy.contains('Provisioned ' + clusterName, { timeout: 90000 });
});

// Command to check CAPI Menu is visible
Cypress.Commands.add('checkCAPIMenu', () => {
  cypressLib.accesMenu('Cluster Management');
  cy.get('.header').contains('CAPI').click();
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
  cy.contains("Provider type").click();
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
  cy.contains(providerType, { matchCase: false }).click();
  cy.contains('Provider: Create ' + providerType, { matchCase: false }).should('be.visible');

  // TODO: Add variables support after capi-ui-extension/issues/49
  cy.getBySel('name-ns-description-namespace').type(namespace + '{enter}');
  cy.typeValue('Name', name);

  // Select Cloud credentials name
  if (providerType != 'docker') {
    cy.getBySel('cluster-prov-select-credential').trigger('click');
    cy.contains(cloudCredentials).click();
  }
  cy.clickButton('Create');
  cy.contains('Providers').should('be.visible');
});

// Command to delete CAPI provider
Cypress.Commands.add('removeProvider', (name) => {
  // Navigate to providers Menu
  cy.checkCAPIMenu();
  cy.contains('Providers').click();
  cy.viewport(1920, 1080);
  cy.typeInFilter(name);
  cy.contains('Ready ' + name).should('be.visible');
  cy.getBySel('sortable-table_check_select_all').click();
  cy.clickButton('Delete');
  cy.getBySel('prompt-remove-confirm-button').click();
  cy.reload();
  cy.contains('Providers').should('be.visible');
  cy.contains(name).should('not.exist');
});

// Command to add AWS Cloud Credentials
Cypress.Commands.add('addCloudCredsAWS', (name, accessKey, secretKey) => {
  cy.accesMenuSelection('Cluster Management', 'Cloud Credentials');
  cy.contains('API Key').should('be.visible');
  cy.clickButton('Create');
  cy.contains('Amazon').click();
  cy.typeValue('Name', name);
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
  cy.contains('Google').click();
  cy.typeValue('Name', name);
  cy.getBySel('text-area-auto-grow').type(gcpCredentials, { log: false });
  cy.clickButton('Create');
  cy.contains('API Key').should('be.visible');
  cy.contains(name).should('be.visible');
});

// Command to Install App from Charts menu
Cypress.Commands.add('installApp', (appName, namespace, questions) => {
  cy.get('.nav').contains('Apps').click();
  cy.contains('Featured Charts').should('be.visible');
  cy.contains(appName, { timeout: 60000 }).click();
  cy.contains('Charts: ' + appName);
  cy.clickButton('Install');
  cy.contains('.outer-container > .header', appName);
  cy.clickButton('Next');

  if (questions != undefined) {
    // Needs to be adapted for different Apps with questions
    if (appName == 'Rancher Turtles') {
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

  cy.clickButton('Install');

  // Close the shell to avoid conflict
  cy.get('.closer').click();

  // Select app namespace
  cy.setNamespace(namespace);

  // Resource should be deployed (green badge)
  cy.get('.outlet').contains('Deployed', { timeout: 180000 });
  cy.namespaceReset();
});

Cypress.Commands.add('patchYamlResource', (clusterName, namespace, resourceKind, resourceName, patch) => {
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

  // Do the CodeMirror stuff here
  // WARNING!!! Hightly experimental code - currently handling nested keys under 'data' only but they have to exist (as data.manifests)
  cy.get('.CodeMirror')
    .then((editor) => {
    var text = editor[0].CodeMirror.getValue();

    // Convert YAML to JSON
    var json = jsyaml.load(text);

    Object.keys(patch).forEach(key => {
      const keys = key.split('.');
      let obj = json;

      // Check if the key is nested under 'data', TODO but there are maybe also other keys with nested values
      if (key.startsWith('data.')) {
        // Extract the nested key after 'data.'
        const nestedKey = key.replace('data.', '');

        // Determine the specific nested key within 'data'
        const [firstKey, ...restKeys] = nestedKey.split('.');
        if (json.data[firstKey]) {
          // Parse the nested YAML content
          let nestedJson = jsyaml.load(json.data[firstKey]);

          // Apply the patch to the nested YAML content
          let nestedObj = nestedJson;
          restKeys.forEach((k, index) => {
            if (index === restKeys.length - 1) {
              nestedObj[k] = patch[key];
            } else {
              if (!nestedObj[k]) nestedObj[k] = {};
              nestedObj = nestedObj[k];
            }
          });

          // Convert the modified nested JSON back to YAML
          json.data[firstKey] = jsyaml.dump(nestedJson);
        }
      } else {
        // Apply the patch to the main JSON object
        while (keys.length > 1) {
          const k = keys.shift();
          if (!obj[k]) obj[k] = {};
          obj = obj[k];
        }
        obj[keys[0]] = patch[key];
      }
    });

    console.log(json);
    text = jsyaml.dump(json);

    editor[0].CodeMirror.setValue(text);
    cy.clickButton('Save');
  })

  // Reset the namespace after the operation
  cy.namespaceReset();
});

// Command to remove cluster from Rancher
Cypress.Commands.add('deleteCluster', (clusterName) => {
  cy.goToHome();
  cy.clickButton('Manage');
  cy.getBySel('cluster-list').should('be.visible');
  cy.contains(clusterName);

  cy.viewport(1920, 1080);
  cy.typeInFilter(clusterName);
  cy.getBySel('sortable-table_check_select_all').click();
  cy.clickButton('Delete');
  cy.getBySel('prompt-remove-input')
    .type(clusterName);
  cy.getBySel('prompt-remove-confirm-button').click();
  cy.contains(clusterName).should('not.exist');
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
Cypress.Commands.add('addFleetGitRepo', (repoName, repoUrl, branch, path) => {
  cy.accesMenuSelection('Continuous Delivery', 'Git Repos');
  cy.contains('fleet-').click();
  cy.contains('fleet-local').should('be.visible').click();
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
})

// Command remove Fleet Git Repository
Cypress.Commands.add('removeFleetGitRepo', (repoName, noRepoCheck) => {
  // Go to 'Continuous Delivery' > 'Git Repos'
  cy.accesMenuSelection('Continuous Delivery', 'Git Repos');
  // Change the namespace to fleet-local using the dropdown on the top bar
  cy.contains('fleet-').click();
  cy.contains('fleet-local').should('be.visible').click();
  // Click the repo link
  cy.contains(repoName).click();
  cy.url().should("include", "fleet/fleet.cattle.io.gitrepo/fleet-local/" + repoName)
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
