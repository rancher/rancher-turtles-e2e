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
import {qase} from 'cypress-qase-reporter/mocha';
import {isRancherManagerVersion} from "~/support/utils";

Cypress.config();
describe('Install CAPI extension - @install', {tags: '@install'}, () => {

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  it('Add capi-ui repo', () => {
    cy.addRepository('capi-ui', 'https://rancher.github.io/capi-ui-extension', 'http', 'none')
  })

  qase(3,
    it('Install CAPI extension', () => {
      cy.contains('Extensions')
        .click();
      cy.contains('CAPI UI');

      if (isRancherManagerVersion('>=2.13')) {
        cy.getBySel('item-card-header-action-menu').click();
        cy.contains('Install').click();
      } else {
        cy.getBySel('extension-card-install-btn-capi').click();
      }

      cy.clickButton('Install');
      cy.contains('Installing');
      cy.contains('Extensions changed - reload required', {timeout: 60000});
      cy.clickButton('Reload');
      // Ensure `Installed` extensions tab is active.
      cy.getBySel('installed').click();
      const pluginSelector = isRancherManagerVersion('>=2.13') ? '.plugin-cards' : '.plugins';
      cy.get(pluginSelector)
        .children()
        .should('contain', 'UI for CAPI cluster provisioning');
    })
  );
});
