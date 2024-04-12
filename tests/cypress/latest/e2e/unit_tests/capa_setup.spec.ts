import '~/support/commands';
import * as cypressLib from '@rancher-ecp-qa/cypress-library';
import { qase } from 'cypress-qase-reporter/dist/mocha';

Cypress.config();
describe('Setup CAPA', () => {
    const namespace = "capa-system"
    const providerName = "aws"
    const providerVersion = "v2.3.5"

    beforeEach(() => {
        cy.login();
        cy.visit('/');
        cypressLib.burgerMenuToggle();
    });


    qase(12,
        it('Create CAPA namespace', () => {
            cy.createNamespace(namespace);
        })
    );

    qase(14,
        it('Create CAPA secret', () => {
            const secretName = 'capa-variables'
            cy.contains('local')
                .click();

            cy.get('.header-buttons > :nth-child(1) > .icon')
                .click();
            cy.contains('Import YAML');
            cy.readFile('./fixtures/capa-secret.yaml').then((data) => {
                cy.get('.CodeMirror')
                    .then((editor) => {
                        data = data.replace(/<replace_me>/g, Cypress.env('aws_b64encoded_credentials'))
                        editor[0].CodeMirror.setValue(data);
                    })
            });

            cy.clickButton('Import');
            cy.contains(secretName).trigger('click');
            cy.url().should('include', 'secret/capa-system/' + secretName);
        })
    );


    qase(13,
        it('Create CAPA provider', () => {
            cypressLib.checkNavIcon('cluster-management')
                .should('exist');

            // Open Turtles menu
            cy.accesMenuSelection('Cluster Management', 'CAPI');

            // Create CAPA Infrastructure provider
            cy.contains('Infrastructure Providers').click();
            cy.clickButton('Create from YAML')
            cy.readFile('./fixtures/capa-provider.yaml').then((data) => {
                cy.get('.CodeMirror')
                    .then((editor) => {
                        editor[0].CodeMirror.setValue(data);
                    })
            })
            cy.clickButton('Create');
            cy.contains('Active ' + providerName + ' ' + providerVersion + ' True', { timeout: 20000 });

            cypressLib.burgerMenuToggle();
            cy.contains('local').click();
            cy.accesMenuSelection('Workloads', 'Deployments');
            cy.setNamespace(namespace);
            cy.contains('Active ' + 'capa-controller-manager');
            cy.namespaceReset();
        })
    );


});
