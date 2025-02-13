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
describe('Install Turtles Operator', { tags: '@install' }, () => {

  beforeEach(() => {
    cy.login();
    cypressLib.burgerMenuToggle();
  });

  it("Change helm charts to Include Prerelease Versions", () => {
    // this test should be run before the turtles repository is added; so that it can fetch the prereleased versions

    // toggle the navigation menu to a close
    cypressLib.burgerMenuToggle();

    cy.getBySel('nav_header_showUserMenu').click();
    cy.contains('Preferences').click();
    cy.contains("Include Prerelease Versions").click();
    cy.reload();
    // check that the prerelease version is selected by ensuring it does not have `bg-disabled` class
    cy.contains("Include Prerelease Versions").should('not.have.class', 'bg-disabled');
  })

  it('Add turtles repo', { retries: 2 }, () => {
    var turtlesHelmRepo = Cypress.env('chartmuseum_repo')
    // if the env var is empty or not defined at all; use the normal repo
    if (turtlesHelmRepo == '') {
      turtlesHelmRepo = 'https://rancher.github.io/turtles/'
    } else {
      turtlesHelmRepo += ':8080'
    }
    cypressLib.addRepository('turtles-operator', turtlesHelmRepo, 'helm', 'none');
  })

  qase([2, 11],
    it('Install Turtles operator', { retries: 1 }, () => {
      cy.contains('local').click();

      // Used for enabling fleet-addon feature within Rancher Turtles installation
      const questions = [
        { menuEntry: 'Rancher Turtles Features Settings', checkbox: 'Enable Agent TLS Mode' }
      ];

      var turtlesVersion = Cypress.env('turtles_operator_version')

      // if operator dev chart is to be used, ignore the turtles version
      var turtlesHelmRepo = Cypress.env('chartmuseum_repo')
      if (turtlesHelmRepo != "" && turtlesHelmRepo != undefined) {
        turtlesVersion = ""
      }

      cy.checkChart('Install', 'Rancher Turtles', 'rancher-turtles-system', turtlesVersion, questions);
    })
  );
});
