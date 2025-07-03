// Create AzureClusterIdentity
Cypress.Commands.add('createAzureClusterIdentity', (clientID, tenantID, clientSecret) => {
    cy.readFile('./fixtures/capz-azure-cluster-identity.yaml').then((data) => {
        data = data.replace(/replace_client_id/g, clientID)
        data = data.replace(/replace_tenant_id/g, tenantID)
        data = data.replace(/replace_client_secret/g, clientSecret)
        cy.importYAML(data)
    });
});

// Create values.yaml Secret
Cypress.Commands.add('createCAPZValuesSecret', (clientID, tenantID, subscriptionID) => {
    cy.readFile('./fixtures/capz-helm-values-secret.yaml').then((data) => {
        data = data.replace(/replace_client_id/g, clientID)
        data = data.replace(/replace_tenant_id/g, tenantID)
        data = data.replace(/replace_subscription_id/g, subscriptionID)
        cy.importYAML(data)
    });
});
