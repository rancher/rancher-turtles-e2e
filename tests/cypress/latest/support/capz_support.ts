// CAPZ secret create function
Cypress.Commands.add('createAzureClusterIdentitySecret', (clientSecret) => {
    //  Creating this secret separately and not as a part of the helmchart ensures that the cluster is deleted successfully
    cy.contains('local')
        .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
        .click();
    cy.contains('Import YAML');
    cy.readFile('./fixtures/capz-client-secret.yaml').then((data) => {
        cy.get('.CodeMirror')
            .then((editor) => {
                data = data.replace(/replace_client_secret/g, clientSecret)
                editor[0].CodeMirror.setValue(data);
            })
    });
    cy.clickButton('Import');
    cy.clickButton('Close');

    // This secret is currently not deleted at the end of test.
});

// Create values.yaml Secret
Cypress.Commands.add('createCAPZValuesSecret', (location, clientID, tenantID, subscriptionID) => {
    cy.contains('local')
        .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
        .click();
    cy.contains('Import YAML');
    var encodedData = ''
    cy.readFile('./fixtures/capz-helm-values.yaml').then((data) => {
        data = data.replace(/replace_location/g, location)
        data = data.replace(/replace_client_id/g, clientID)
        data = data.replace(/replace_tenant_id/g, tenantID)
        data = data.replace(/replace_subscription_id/g, subscriptionID)
        encodedData = btoa(data)
    })

    cy.readFile('./fixtures/capz-helm-values-secret.yaml').then((data) => {
        cy.get('.CodeMirror')
            .then((editor) => {
                data = data.replace(/replace_values/g, encodedData)
                editor[0].CodeMirror.setValue(data);
            })
    });

    cy.clickButton('Import');
    cy.clickButton('Close');
});

// Create AzureClusterIdentity
Cypress.Commands.add('createAzureClusterIdentity', (clientID, tenantID) => {
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
                editor[0].CodeMirror.setValue(data);
            })
    });

    cy.clickButton('Import');
    cy.clickButton('Close');
});
