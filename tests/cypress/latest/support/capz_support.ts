// Create AzureClusterIdentity
Cypress.Commands.add('createAzureClusterIdentity', (clientID, tenantID, clientSecret) => {
    cy.contains('local')
        .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
        .click();
    cy.contains('Import YAML');

    cy.readFile('./fixtures/capz-azure-cluster-identity.yaml').then((data) => {
        cy.get('.CodeMirror')
            .then((editor) => {
                data = data.replace(/replace_client_id/g, clientID)
                data = data.replace(/replace_tenant_id/g, tenantID)
                data = data.replace(/replace_client_secret/g, clientSecret)
                editor[0].CodeMirror.setValue(data);
            })
    });
    cy.clickButton('Import');
    cy.clickButton('Close');
});

// Create values.yaml Secret
Cypress.Commands.add('createCAPZValuesSecret', (clientID, tenantID, subscriptionID) => {
    cy.contains('local')
        .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
        .click();
    cy.contains('Import YAML');

    cy.readFile('./fixtures/capz-helm-values-secret.yaml').then((data) => {
        cy.get('.CodeMirror')
            .then((editor) => {
                data = data.replace(/replace_client_id/g, clientID)
                data = data.replace(/replace_tenant_id/g, tenantID)
                data = data.replace(/replace_subscription_id/g, subscriptionID)
                editor[0].CodeMirror.setValue(data);
            })
    });
    cy.clickButton('Import');
    cy.clickButton('Close');
});
