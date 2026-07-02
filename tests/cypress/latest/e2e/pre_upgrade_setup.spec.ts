import '../support/commands';
import {setUseCAAPFFeatureGate} from "../support/commands";
import {isRancherManagerVersion} from "../support/utils";
import {setUseCAAPFFeatureGate} from "../support/commands";

Cypress.config();
describe('Pre Rancher Upgrade Setup - @upgrade', {tags: '@upgrade'}, () => {

  beforeEach(function () {
    if (!isRancherManagerVersion('2.13')){
      this.skip();
    }
    cy.login();
    cy.burgerMenuOperate('open');
  });

  qase(509, it("Enable use-caapf feature gate before Rancher upgrade", () => {
      // At this point the feature does not really exist, but it should be set before upgrading Rancher Turtles via Rancher Manager upgrade,
      // which is also one of the reasons why we do not wait for it to take effect
      setUseCAAPFFeatureGate(true, false)
  })
  );
});
