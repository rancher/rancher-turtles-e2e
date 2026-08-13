/*
 Copyright © 2022 - 2026 SUSE LLC

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
import {isMigration, isRancherManagerVersion, isTurtlesDevChart, turtlesNamespace,} from '../support/utils';
import {addChartMuseumRepo, addTurtlesProvidersRepo} from "../support/commands";
import {vars} from '../support/variables';

Cypress.config();
describe('Install Turtles Chart - @install', {tags: '@install'}, () => {
  before(function () {
    if (!isRancherManagerVersion('2.12')) {
      cy.task('suiteLog', "Skipping for Rancher Version != 2.12").then(() => {
        return this.skip();
      })
    }
  })

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });


  let addTurtlesRepo = function () {
    cy.task('suiteLog', "Adding turtles-chart repo");
    cy.addRepository('turtles-chart', 'https://rancher.github.io/turtles/', 'http', 'none');
  }

  qase(404,
    it("Add turtles GitRepo", () => {
      if (isTurtlesDevChart) {
        addChartMuseumRepo();
      } else {
        addTurtlesRepo();
      }

      if (isMigration) {
        // Used in Pre-migration: For Migration test; turtles will be installed from turtles-chart repo.
        // dev=true is only applicable for 2.13 or version test is migrating to.
        addTurtlesRepo();
        // In Post-migration, chartmuseum repo will be used to install providers chart for dev=true and OCI repo for
        // dev=false.
        if (!isTurtlesDevChart) {
          addTurtlesProvidersRepo();
        }
      }
    })
  );

  qase(11, it('Install Turtles chart', {retries: 1}, () => {
      cy.checkChart(vars.localCluster, 'Install', 'Rancher Turtles', turtlesNamespace, {version: isMigration ? '0.24.5' : undefined});
    })
  );
});
