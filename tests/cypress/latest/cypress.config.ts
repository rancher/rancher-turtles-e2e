import {defineConfig} from 'cypress'
import {writeFileSync} from 'fs';
import {plugin as cypressGrepPlugin} from '@cypress/grep/plugin';

const qaseAPIToken = process.env.QASE_API_TOKEN

export default defineConfig({
  defaultCommandTimeout: 30000,
  video: true,
  viewportWidth: 1920,
  viewportHeight: 1080,
  allowCypressEnv: false,
  experimentalMemoryManagement: true,
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    reporterEnabled: 'cypress-mochawesome-reporter, cypress-qase-reporter',
    cypressMochawesomeReporterReporterOptions: {
      charts: true,
    },
    cypressQaseReporterReporterOptions: {
      mode: "testops",
      debug: true,
        testops: {
          api: {
           token: qaseAPIToken,
          },
          project: 'PT',
          uploadAttachments: true,
          run: {
            complete: true,
          },
        },
      framework: {
        cypress: {
          screenshotsFolder: './screenshots',
        },
      },
    },
  },
  expose: {
    "grepFilterSpecs": true
  },
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      // 1. Browser launch options
      on("before:browser:launch", (browser, launchOptions) => {
        if (["chrome", "edge"].includes(browser.name)) {
          launchOptions.args.push("--no-sandbox", "--disable-gpu", "--use-gl=swiftshader", "--js-flags=--max-old-space-size=8192", "--disable-dev-shm-usage");
        }
        return launchOptions;
      });

      // 2. Custom plugins
      require('./plugins/index.ts')(on, config);
      cypressGrepPlugin(config);

      // 3. Register your custom before:spec FIRST (if you are on Cypress < 12)
      // or combine them if you notice the text file isn't generating.
      on('before:spec', () => {
        const qaseRunId = process.env.QASE_TESTOPS_RUN_ID;
        if (qaseRunId) {
          writeFileSync('./QASE_TESTOPS_RUN_ID.txt', qaseRunId, {encoding: 'utf8'});
        }
      });

      // 4. Register Qase Plugins LAST so their hooks wrap everything correctly
      require('cypress-qase-reporter/metadata')(on);
      require('cypress-qase-reporter/plugin')(on, config);

      // REMOVED: on('after:spec') manual block

      on('task', {
        suiteLog(message) {
          console.log(message);
          return null;
        },
      });

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
