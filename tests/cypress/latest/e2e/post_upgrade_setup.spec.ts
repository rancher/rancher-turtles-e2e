import '../support/commands';
import {vars} from '../support/variables';
import {isRancherManagerVersion, isTurtlesDevChart, turtlesNamespace} from '../support/utils';

Cypress.config();
describe('Post Upgrade', {tags: '@upgrade'}, () => {
  let turtlesChartDevVersion = Cypress.expose('turtles_chart_dev_version')
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
    if (isTurtlesDevChart) {
      cy.contains(turtlesChartDevVersion, {timeout: timeout});
    } else if (isRancherManagerVersion('2.14')) {
      cy.contains('0.26', {timeout: timeout});
    }
    cy.waitForAllRowsInState('Deployed', timeout);
  })

});
