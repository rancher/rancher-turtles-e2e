/// <reference types="cypress" />

declare namespace Cypress {
  interface SuiteConfigOverrides {
    tags?: string | string[];
  }
  interface TestConfigOverrides {
    tags?: string | string[];
  }
}
