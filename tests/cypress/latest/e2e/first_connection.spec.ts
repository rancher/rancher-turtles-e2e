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

import * as cypressLib from '@rancher-ecp-qa/cypress-library';

Cypress.config();
describe('First login on Rancher - @install', {tags: '@install'}, () => {
  const password = 'rancherpassword'

  it('Log in and accept terms and conditions', () => {
    // Store the env object in a variable for easier access
    const env = Cypress.expose();

    // Save the original value (so we don't lose it forever)
    const originalPassword = Cypress.expose('password');
    //console.log('original password over expose: ', Cypress.expose('password'));

    // Set the temporary password for the login
    env.password = password
    //console.log('changed password over expose: ', Cypress.expose('password'));

    cypressLib.firstLogin();

    // Restore the original value
    env.password = originalPassword;
    //console.log('restored password over expose: ', Cypress.expose('password'));
  })

  it('Change Rancher password', () => {
    // Change default password
    cy.login(Cypress.expose('username'), password);
    cy.getBySel('nav_header_showUserMenu').click();
    cy.contains('Account & API Keys').click();
    cy.clickButton('Change Password');
    cy.typeValue('Current Password', password);
    cy.typeValue('New Password', Cypress.expose('password'), false, false);
    cy.typeValue('Confirm Password', Cypress.expose('password'), false, false);
    cy.clickButton('Apply');
    cy.contains('Error').should('not.exist');
    cy.contains('Generate a random password').should('not.exist');
  })
})
