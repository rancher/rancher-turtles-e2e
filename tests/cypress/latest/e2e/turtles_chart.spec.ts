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

Cypress.config();
describe('Install Turtles Chart - @install', { tags: '@install' }, () => {

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  it("Change helm charts to Include Prerelease Versions", () => {
    // this test should be run before the turtles repository is added; so that it can fetch the prereleased versions

    // toggle the navigation menu to a close
    cy.burgerMenuOperate('close');

    cy.getBySel('nav_header_showUserMenu').click();
    cy.contains('Preferences').click();
    cy.contains("Include Prerelease Versions").click();
    cy.reload();
    // check that the prerelease version is selected by ensuring it does not have `bg-disabled` class
    cy.contains("Include Prerelease Versions").should('not.have.class', 'bg-disabled');
  })

  it('Add turtles repo', { retries: 2 }, () => {
    let turtlesHelmRepo = Cypress.env('chartmuseum_repo')
    // if the env var is empty or not defined at all; use the normal repo
    if (turtlesHelmRepo == '') {
      turtlesHelmRepo = 'https://rancher.github.io/turtles/'
    } else {
      turtlesHelmRepo += ':8080'
    }
    cy.addRepository('turtles-chart', turtlesHelmRepo, 'http', 'none');
  })

  qase([2, 11],
    it('Install Turtles chart', {retries: 1}, () => {
      cy.contains('local').click();

      let turtlesVersion = Cypress.env('turtles_chart_version')

      // if turtles dev chart is to be used, ignore the turtles chart version
      const turtlesHelmRepo = Cypress.env('chartmuseum_repo')
      if (turtlesHelmRepo != "" && turtlesHelmRepo != undefined) {
        turtlesVersion = ""
      }

      if (Cypress.env('grepTags') && (Cypress.env('grepTags')).includes('@upgrade')) {
        // Required to validate turtles/issues/1395
        turtlesVersion = '0.21.0'
      }
      cy.checkChart('Install', 'Rancher Turtles', 'rancher-turtles-system', turtlesVersion);
    })
  );
});
