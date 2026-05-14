import '../support/commands';
import {isRancherManagerVersion} from "../support/utils";

Cypress.config();
describe('Pre Upgrade', {tags: '@upgrade'}, () => {

  beforeEach(function () {
    if (!isRancherManagerVersion('2.13')){
      this.skip();
    }
    cy.login();
    cy.burgerMenuOperate('open');
  });

  it("Enable use-caapf feature gate before Rancher upgrade", () => {
    const enableFeatureGate = (text: any) => {
      // to disable the feature flag, simply removing this data won't be enough. The value must be reset to "false".
      text.data["rancher-turtles"] = `{"features": {"use-caapf": {"enabled": "true"}}}`;
    }
    cy.editKubernetesResource({
      name: "rancher-config",
      clusterName: "local",
      resourcePath: ["More Resources", "Core", "ConfigMaps"],
      namespace: "cattle-system",
      modifyYAMLOperation: enableFeatureGate
    });

    //   At this point the feature does not really exist, but it should be set before upgrading Rancher Turtles via Rancher Manager upgrade.
  });
});
