import '../support/commands';
import {vars} from '../support/variables';
import {isTurtlesDevChart, turtlesNamespace} from '../support/utils';

Cypress.config();
describe('Post Upgrade', {tags: '@upgrade'}, () => {
  const timeout = vars.shortTimeout

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  it('Check the local cluster status is active post-upgrade', ()=>{
    // Check local cluster is Active
    const localCluster = 'local'
    cy.searchCluster(localCluster);
    cy.contains(new RegExp('Active.*' + localCluster), {timeout: timeout});
  })

  it('Check upgraded Turtles chart', () => {
    cy.exploreCluster('local');
    cy.setNamespace(turtlesNamespace);
    cy.clickNavMenu(['Apps', 'Installed Apps']);
    cy.typeInFilter('rancher-turtles');
    cy.getBySel('sortable-cell-0-1').should('exist');

    const turtlesChartVersion = isTurtlesDevChart? Cypress.expose('turtles_chart_dev_version'): '0.26'
    cy.getBySel('sortable-cell-0-3').contains(turtlesChartVersion, {timeout: timeout});
    cy.waitForAllRowsInState('Deployed', timeout);
  })

});
