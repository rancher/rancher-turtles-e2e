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

import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';
import * as utils from "~/support/utils";

Cypress.config();
describe('Install CAPI plugin', () => {

  beforeEach(() => {
    cy.login();
    cy.visit('/');
    cypressLib.burgerMenuToggle();
  });

  qase(11,
    it('Add capi-ui repo', () => {
      cypressLib.addRepository('capi-ui', 'https://github.com/rancher/capi-ui-extension.git', 'git', 'gh-pages')
    })
  );
  
  qase(12,
    it('Enable extension support', () => {
      cypressLib.enableExtensionSupport(true);
    })
  );

  qase(13,
    it('Install CAPI plugin', () => {
      // TODO: create a function to install any plugin and not elemental only
      cy.contains('Extensions')
        .click();
      cy.contains('CAPI UI');
        
      if (utils.isRancherManagerVersion('2.7')) {
        cy.getBySel('"extension-card-install-btn-CAPI UI"').click();
      } else {
        cy.getBySel('extension-card-install-btn-capi').click();
      }  
      
      cy.clickButton('Install');
      cy.contains('Installing');
      cy.contains('Extensions changed - reload required', {timeout: 40000});
      cy.clickButton('Reload');
      cy.get('.plugins')
        .children()
        .should('contain', 'UI for CAPI cluster provisioning')
        .and('contain', 'Uninstall');
    })
  );
});
