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
  isRancherManagerVersion,
  isUpgrade,
  isUseCAAPFSupported, skipFleetAddOnInstallation,
  turtlesNamespace,
} from '../support/utils';
import {providers, vars} from '../support/variables';
import {matchAndWaitForProviderReadyStatus, setUseCAAPFFeatureGate} from "../support/commands";


Cypress.config();
describe('Enable use-caapf feature gate and install fleet-addon provider', {tags: '@install'}, () => {
  before(function () {
    if (isRancherManagerVersion('2.12')){
      return cy.task('suiteLog', 'Skipping test on Rancher 2.12...').then(()=>{
        this.skip();
      })
    }

    if (skipFleetAddOnInstallation) {
      return cy.task('suiteLog', 'SKIP_FLEET_ADDON_INSTALLATION=true; Skipping fleet-addon provider installation...').then(()=>{
        this.skip();
      })
    }
  })

  beforeEach(function (){
    cy.login();
    cy.burgerMenuOperate('open');
  })

  if (isUseCAAPFSupported && !isUpgrade) {
    // This feature gate needs to be enabled for >=2.14.1
    // This feature is set to true(in pre_upgrade_setup.spec.ts) before the rancher upgrade; that's why we skip this
    // step for upgrade test.
    qase(436, it('Enable turtles feature gate: use-caapf', () => {
        setUseCAAPFFeatureGate(true);
      })
    );
  }

  if (isRancherManagerVersion('>=2.14')) {
    // In <2.14 versions, fleet is enabled by default
    it('Enable Fleet addon provider', () => {
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
  }

  qase(368,
    it('Verify Fleet addon provider', () => {
      cy.navigateToProviders();
      matchAndWaitForProviderReadyStatus(providers.fleetProvider, 'addon', providers.fleetProvider, providers.fleetProviderVersion, 'fleet-addon-system');
    })
  );

});
