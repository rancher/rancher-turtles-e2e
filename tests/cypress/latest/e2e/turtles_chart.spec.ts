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

import '../support/commands';
import {vars} from '../support/variables';
import {isMigration, isRancherManagerVersion, isTurtlesDevChart, isUpgrade, turtlesNamespace} from '../support/utils';

Cypress.config();
describe('Install Turtles Chart - @install', {tags: '@install'}, () => {
  let chartMuseumRepo = Cypress.expose('chartmuseum_repo')

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  let addTurtlesProvidersRepo = function () {
    cy.task('suiteLog', "Adding turtles-providers-chart repo");
    cy.addRepository('turtles-providers-chart', vars.turtlesProvidersOCIRepo, 'oci', 'none')
  }

  let addChartMuseumRepo = function () {
    cy.task('suiteLog', "Adding chartmuseum repo");
    expect(chartMuseumRepo, "checking chartmuseum repo").to.not.be.empty;
    cy.addRepository('chartmuseum-repo', `${chartMuseumRepo}:8080`, 'http', 'none');
  }

  let addTurtlesRepo = function () {
    cy.task('suiteLog', "Adding turtles-chart repo");
    cy.addRepository('turtles-chart', 'https://rancher.github.io/turtles/', 'http', 'none');
  }

  if (isRancherManagerVersion(">=2.13")) {
    qase(403, it("Add turtles-providers GitRepo", () => {
      if (isTurtlesDevChart) {
        addChartMuseumRepo();
      } else {
        addTurtlesProvidersRepo();
      }

      if (isRancherManagerVersion('2.13') && isUpgrade) {
        // Used in Pre-upgrade: For Upgrade tests; providers will be installed from turtles-providers-chart repo
        // TODO(pvala): this needs to be fixed, the chart repository added depends on the current rancher version rather than the upgrade rancher version.
        // For e.g. if rancher version is prime/2.13.7 and upgrade version is prime-alpha/2.14.4-alpha3, it will add regular registry instead of staging registry
        addTurtlesProvidersRepo();
        // In Post-upgrade, providers will be installed using chartmuseum repo
      }
    })
    );
  }

  if (isRancherManagerVersion("2.12")) {
    qase(404, it("Add turtles GitRepo", () => {
      if (isTurtlesDevChart) {
        addChartMuseumRepo();
      } else {
        addTurtlesRepo();
      }

      if (isMigration) {
        // Used in Pre-migration: For Migration test; turtles will be installed from turtles-chart repo.
        // dev=true is only applicable for 2.13 or version test is upgrading to.
        addTurtlesRepo();
        // In Post-migration, chartmuseum repo will be used to install providers chart for dev=true and OCI repo for dev=false.
        if(!isTurtlesDevChart) {
          addTurtlesProvidersRepo();
        }
      }
    })
    );

    qase(11, it('Install Turtles chart', {retries: 1}, () => {
        cy.checkChart('local', 'Install', 'Rancher Turtles', turtlesNamespace, {version: isMigration ? '0.24.5' : undefined});
      })
    );
  }
});
