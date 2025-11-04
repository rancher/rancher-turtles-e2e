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
import {isRancherManagerVersion, turtlesNamespace} from '~/support/utils';

Cypress.config();
describe('Install Turtles Chart - @install', {tags: '@install'}, () => {
  let chartMuseumRepo = Cypress.env('chartmuseum_repo')
  let turtlesVersion = Cypress.env('turtles_chart_version')
  let devChart = Cypress.env('turtles_dev_chart')

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

  if (devChart || isRancherManagerVersion('>=2.13')) {
    it('Add chartmuseum repo', () => {
      // this test is needed to install providers chart (for 2.13) and turtles dev build
      expect(chartMuseumRepo, "checking chartmuseum repo").to.not.be.undefined;
      cy.addRepository('chartmuseum-repo', `${chartMuseumRepo}:8080`, 'http', 'none');
    })
  }

  if (!devChart && isRancherManagerVersion('<2.13')) {
    // for all Rancher versions <2.13; we add the repo if not testing turtles dev build
    it('Add turtles dev repo', {retries: 1}, () => {
      cy.addRepository('turtles-chart', 'https://rancher.github.io/turtles/', 'http', 'none');
    })
  }


  // Skip for 2.13, TODO: remove check  after turtles/issues/1811 is fixed
  if (isRancherManagerVersion('<=2.12')) {
    qase([2, 11],
      it('Install Turtles chart', {retries: 1}, () => {
        // if turtles dev chart is to be used, ignore the turtles chart version
        if (!devChart) {
          turtlesVersion = ""
        }

        if (Cypress.env('grepTags') && (Cypress.env('grepTags')).includes('@upgrade')) {
          // Required to validate turtles/issues/1395
          turtlesVersion = '0.21.0'
        }
        cy.checkChart('local', 'Install', 'Rancher Turtles', turtlesNamespace, turtlesVersion);
      })
    );
  }
});
