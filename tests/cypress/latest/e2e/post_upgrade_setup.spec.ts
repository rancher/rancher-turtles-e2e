import '../support/commands';
import {vars} from '../support/variables';
import {isTurtlesDevChart, turtlesNamespace} from '../support/utils';

Cypress.config();
describe('Post Upgrade', {tags: '@upgrade'}, () => {
  // Since we upgrade to 2.14, turtles chart version value can be hardcoded for dev=false
  let turtlesChartVersion: string = isTurtlesDevChart ? Cypress.expose('turtles_chart_dev_version') : '0.26';
  const timeout = vars.shortTimeout

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  it('Check upgraded Turtles chart', () => {
    cy.exploreCluster('local');
    cy.setNamespace(turtlesNamespace);
    cy.clickNavMenu(['Apps', 'Installed Apps']);
    cy.typeInFilter('rancher-turtles');
    cy.getBySel('sortable-cell-0-1').should('exist');
    cy.contains(turtlesChartVersion, {timeout: timeout});
    cy.waitForAllRowsInState('Deployed', timeout);
  })

});
