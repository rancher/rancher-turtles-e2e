import '~/support/commands';
import {vars} from '~/support/variables';
import {turtlesNamespace} from '~/support/utils';

Cypress.config();
describe('Post Upgrade', {tags: '@upgrade'}, () => {
  let chartMuseumRepo = Cypress.expose('chartmuseum_repo')
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
    cy.contains(turtlesChartDevVersion, {timeout: timeout});
    cy.waitForAllRowsInState('Deployed', timeout);
  })

  it("Add turtles-providers GitRepo", () => {
    cy.task('log', "Adding chartmuseum repo for turtles-providers");
    expect(chartMuseumRepo, "checking chartmuseum repo").to.not.be.empty;
    cy.addRepository('chartmuseum-repo', `${chartMuseumRepo}:8080`, 'http', 'none');
  })
});
