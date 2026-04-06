// Create AzureClusterIdentity
Cypress.Commands.add('createAzureClusterIdentity', (clientID, tenantID, clientSecret) => {
    cy.readFile('./fixtures/azure/capz-azure-cluster-identity.yaml').then((data) => {
        data = data.replace(/replace_client_id/g, clientID)
        data = data.replace(/replace_tenant_id/g, tenantID)
        data = data.replace(/replace_client_secret/g, clientSecret)
        cy.importYAML(data)
    });
});

Cypress.Commands.add('createAzureASOCredential', (clientID, tenantID, clientSecret, subscriptionID: string) => {
    cy.readFile('./fixtures/azure/aso-credential-secret.yaml').then((data) => {
        data = data.replace(/replace_client_id/g, clientID)
        data = data.replace(/replace_tenant_id/g, tenantID)
        data = data.replace(/replace_client_secret/g, clientSecret)
        data = data.replace(/replace_subscription_id/g, subscriptionID)
        cy.importYAML(data)
    });
})
