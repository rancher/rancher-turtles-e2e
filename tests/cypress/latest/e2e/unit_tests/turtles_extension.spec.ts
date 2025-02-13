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

Cypress.config();
describe('Install CAPI extension', { tags: '@install' }, () => {

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  it('Add capi-ui repo', { retries: 2 }, () => {
    cypressLib.addRepository('capi-ui', 'https://github.com/rancher/capi-ui-extension.git', 'git', 'gh-pages')
  })

  qase(3,
    it('Install CAPI extension', () => {
      cy.contains('Extensions')
        .click();
      cy.contains('CAPI UI');

      cy.getBySel('extension-card-install-btn-capi').click();
      
      var capiUIVersion = Cypress.env('capi_ui_version')
      // if the env var is empty or not defined at all; use the latest version
      if (capiUIVersion != "" && capiUIVersion != undefined) {
        cy.getBySel('install-ext-modal-select-version').click();
        cy.contains(capiUIVersion).click();
      }

      cy.clickButton('Install');
      cy.contains('Installing');
      cy.contains('Extensions changed - reload required', { timeout: 40000 });
      cy.clickButton('Reload');
      cy.get('.plugins')
        .children()
        .should('contain', 'UI for CAPI cluster provisioning')
        .and('contain', 'Uninstall');
    })
  );
});
