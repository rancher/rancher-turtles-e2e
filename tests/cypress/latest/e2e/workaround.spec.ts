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

Cypress.config();
describe('Turtles Chart Installation Workaround - @install', {tags: '@install'}, () => {
  let turtlesHelmRepo = Cypress.env('chartmuseum_repo')
  let devChart = turtlesHelmRepo != ''

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  if (devChart) {
    it("Disable embedded-cluster-api feature", () => {
      cy.importYAML('fixtures/providers-chart/embedded-cluster-api-disable-feature.yaml')
    })

    it('Delete webhooks', () => {
      cy.deleteKubernetesResource('local', ['More Resources', 'Admission', 'MutatingWebhookConfiguration'], 'mutating-webhook-configuration')
      cy.deleteKubernetesResource('local', ['More Resources', 'Admission', 'ValidatingWebhookConfiguration'], 'validating-webhook-configuration')
    })
  }

});
