import { defineConfig } from 'cypress'

const qaseAPIToken = process.env.QASE_API_TOKEN

export default defineConfig({
  defaultCommandTimeout: 30000,
  video: true,
  experimentalMemoryManagement: true,
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    reporterEnabled: 'cypress-mochawesome-reporter, cypress-qase-reporter',
    cypressMochawesomeReporterReporterOptions: {
      charts: true,
    },
    cypressQaseReporterReporterOptions: {
      apiToken: qaseAPIToken,
      projectCode: 'RT',
      logging: false,
      basePath: 'https://api.qase.io/v1',
    },
  },
  env: {
    "grepFilterSpecs": true
  },
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      // Help for memory issues.
      // Ref: https://www.bigbinary.com/blog/how-we-fixed-the-cypress-out-of-memory-error-in-chromium-browsers
      on("before:browser:launch", (browser, launchOptions) => {

        if (["chrome", "edge"].includes(browser.name)) {
          launchOptions.args.push("--no-sandbox");
          launchOptions.args.push("--disable-gl-drawing-for-tests");
          launchOptions.args.push("--disable-gpu");
          launchOptions.args.push("--js-flags=--max-old-space-size=3500");
        }
        return launchOptions;
      });
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('./plugins/index.ts')(on, config)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('@cypress/grep/src/plugin')(config);
      return config;
    },
    supportFile: './support/e2e.ts',
    fixturesFolder: './fixtures',
    screenshotsFolder: './screenshots',
    videosFolder: './videos',
    downloadsFolder: './downloads',
    specPattern: 'e2e/*.spec.ts',
  },
})
