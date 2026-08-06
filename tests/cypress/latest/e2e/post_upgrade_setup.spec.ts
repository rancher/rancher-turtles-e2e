import '../support/commands';
import {vars} from '../support/variables';
import {isTurtlesDevChart, turtlesNamespace} from '../support/utils';

Cypress.config();
describe('Post Rancher Upgrade Checks - @upgrade', {tags: '@upgrade'}, () => {
  const rancherVersion = '2.14'
  const turtlesChartVersion = isTurtlesDevChart? Cypress.expose('turtles_chart_dev_version'): '0.26'

  beforeEach(() => {
    cy.login();
    cy.burgerMenuOperate('open');
  });

  qase(510, it('Check the local cluster status is active post-upgrade', {retries: 1}, ()=>{
    // Check local cluster is Active
    cy.searchCluster(vars.localCluster);
    cy.contains(new RegExp('Active.*' + vars.localCluster), {timeout: vars.shortTimeout});
  })
  );

  qase(511, it('Check upgraded Rancher & Turtles Apps', {retries: 1}, () => {
    cy.checkAppDeployed('rancher', vars.cattleSystemNS, rancherVersion);
    cy.checkAppDeployed('rancher-turtles', turtlesNamespace, turtlesChartVersion);
  })
  );
});
