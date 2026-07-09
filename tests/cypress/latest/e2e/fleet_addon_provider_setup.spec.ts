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
import {
  determineBuildType,
  isUpgrade,
  isUseCAAPFSupported,
  turtlesNamespace,
} from '../support/utils';
import {providers, vars} from '../support/variables';
import {matchAndWaitForProviderReadyStatus, setUseCAAPFFeatureGate} from "../support/commands";


Cypress.config();
describe('Enable use-caapf feature gate', {tags: '@install'}, () => {
  beforeEach(function () {
    // This feature gate needs to be enabled for >=2.14.1
    if (!isUseCAAPFSupported){
      cy.task('suiteLog', 'use-caapf feature gate is not supported; skipping...');
      this.skip();
    }
    if(isUpgrade){
      // This feature is set to true(in pre_upgrade_setup.spec.ts) before the rancher upgrade;
      // that's why we skip this step for upgrade test.
      cy.task('suiteLog', 'use-caapf feature gate is already enabled by pre_upgrade_setup; skipping...');
      this.skip();
    }

    cy.login();
    cy.burgerMenuOperate('open');
  });


  qase(436, it('Enable turtles feature gate: use-caapf', () => {
      setUseCAAPFFeatureGate(true);
    })
  );

  it('Enable fleet-addon provider', ()=>{
    const providerSelectionFunction = (text: any) => {
      // fleet-addon needs to be explicitly enabled for >=2.14.1.
      // @ts-ignore
      text.providers.addonFleet.enabled = true;

    }

    cy.checkChart('local', vars.chartUpdateOperation, vars.turtlesProvidersChartName, turtlesNamespace, {
      version: vars.turtlesProvidersChartVersion,
      modifyYAMLOperation: providerSelectionFunction
    });
  })

  qase(368,
    it('Verify Fleet addon provider', () => {
      const buildType = determineBuildType();
      const fleetProviderVersion = providers.version[buildType].fleet

      cy.navigateToProviders();
      matchAndWaitForProviderReadyStatus(providers.fleetProvider, 'addon', providers.fleetProvider, fleetProviderVersion, 'fleet-addon-system');
    })
  );

});

