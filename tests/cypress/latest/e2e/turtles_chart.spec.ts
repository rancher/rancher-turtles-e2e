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
import {isRancherManagerVersion, isMigration, turtlesNamespace} from '~/support/utils';

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

  if (isRancherManagerVersion(">=2.13")) {
    it("Add turtles and turtles-providers GitRepo", () => {
      if (devChart) {
        cy.task('log', "Adding chartmuseum repo");
        expect(chartMuseumRepo, "checking chartmuseum repo").to.not.be.empty;
        cy.addRepository('chartmuseum-repo', `${chartMuseumRepo}:8080`, 'http', 'none');
      } else {
        cy.task('log', "Adding turtles-providers-chart repo");
        cy.addRepository('turtles-providers-chart', 'oci://registry.suse.com/rancher/charts/rancher-turtles-providers', 'oci', 'none')
      }
    })
  }

  if (isRancherManagerVersion("<=2.12")) {
    it("Add turtles and turtles-providers GitRepo", () => {
      if (devChart) {
        cy.task('log', "Adding turtles dev chart repo");
        expect(chartMuseumRepo, "checking chartmuseum repo").to.not.be.empty;
        cy.addRepository('chartmuseum-repo', `${chartMuseumRepo}:8080`, 'http', 'none');
        if (isMigration) {
          // For <=2.12, dev=true, and migration test, we will install turtles from standard chart repo;
          // dev=true is only applicable for 2.13 or version test is upgrading to.
          cy.burgerMenuOperate('open');
          cy.task('log', "Adding turtles chart repo for migration test");
          cy.addRepository('turtles-chart', 'https://rancher.github.io/turtles/', 'http', 'none');
        }
      } else {
        cy.task('log', "Adding turtles chart repo");
        cy.addRepository('turtles-chart', 'https://rancher.github.io/turtles/', 'http', 'none');
        if (isMigration) {
          cy.burgerMenuOperate('open');
          cy.task('log', "Adding turtles-providers-chart repo for migration test");
          cy.addRepository('turtles-providers-chart', 'oci://registry.suse.com/rancher/charts/rancher-turtles-providers', 'oci', 'none')
        }
      }
    })

    qase([2, 11],
      it('Install Turtles chart', {retries: 1}, () => {
        // if turtles dev chart is to be used, ignore the turtles chart version
        if (devChart) {
          turtlesVersion = ""
        }

        if (isMigration) {
          turtlesVersion = '0.24.3'
        }
        cy.checkChart('local', 'Install', 'Rancher Turtles', turtlesNamespace, turtlesVersion);
      })
    );
  }
});
