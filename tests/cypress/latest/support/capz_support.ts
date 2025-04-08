// Create AzureClusterIdentity
Cypress.Commands.add('createAzureClusterIdentity', (clientSecret, clientID, tenantID) => {
    cy.contains('local')
        .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
        .click();
    cy.contains('Import YAML');

    cy.readFile('./fixtures/capz-azure-cluster-identity.yaml').then((data) => {
        cy.get('.CodeMirror')
            .then((editor) => {
                data = data.replace(/replace_client_secret/g, clientSecret)
                data = data.replace(/replace_client_id/g, clientID)
                data = data.replace(/replace_tenant_id/g, tenantID)
                editor[0].CodeMirror.setValue(data);
            })
    });

    cy.clickButton('Import');
    cy.clickButton('Close');
});

// Create values.yaml Secret
Cypress.Commands.add('createCAPZValuesSecret', (location, clientID, tenantID, subscriptionID, version?: string, registrationMethod?: string, userpoolCount = 2, systempoolCount = 1) => {
    cy.contains('local')
        .click();
    cy.get('.header-buttons > :nth-child(1) > .icon')
        .click();
    cy.contains('Import YAML');

    cy.readFile('./fixtures/capz-helm-values-secret.yaml').then((data) => {
        cy.get('.CodeMirror')
            .then((editor) => {
                data = data.replace(/replace_location/g, location)
                data = data.replace(/replace_client_id/g, clientID)
                data = data.replace(/replace_tenant_id/g, tenantID)
                data = data.replace(/replace_version/g, version)
                data = data.replace(/replace_rke2_registration_method/g, registrationMethod)
                data = data.replace(/replace_subscription_id/g, subscriptionID)
                data = data.replace(/replace_userpoolCount/g, userpoolCount)
                data = data.replace(/replace_systempoolCount/g, systempoolCount)
                editor[0].CodeMirror.setValue(data);
            })
    });

    cy.clickButton('Import');
    cy.clickButton('Close');
});
