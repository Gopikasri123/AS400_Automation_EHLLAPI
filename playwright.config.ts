import { defineConfig, devices } from '@playwright/test';
import type { GepOptions } from './fixtures/gepFixtures';
import { ENV, selectedMarketIds, selectedTestEnv } from './src/config/env';

// Headless (CI, HEADLESS=true): fixed 1920x1080 so every run renders the same layout.
// Headed (local): a maximised window sized to the screen, so the whole page stays in view.
// deviceScaleFactor is dropped because Playwright rejects it with a null viewport.
const { deviceScaleFactor: _deviceScaleFactor, ...desktopChrome } = devices['Desktop Chrome'];
const browserWindow = ENV.headless
  ? { viewport: { width: 1920, height: 1080 } }
  : { viewport: null, launchOptions: { args: ['--start-maximized'] } };

// TEST_ENV (default qa). QA keeps the usual folders (the heal and flow-check scripts read test-results/results.json);
// other environments write to <folder>-<env>, so QA, UAT and prod can run side by side without overwriting each other.
const testEnv = selectedTestEnv();
const runFolder = (folder: string) => (testEnv === 'qa' ? folder : `${folder}-${testEnv}`);

// Reports of each run go to reports/GEP_Report_<YYYY-MM-DD>_<HH-mm-ss>/ (html/ and monocart/), so earlier runs are kept.
// The stamp is stored in the environment because workers load this file again and must not get a new one.
const pad = (n: number) => String(n).padStart(2, '0');
const now = new Date();
process.env.GEP_REPORT_STAMP ??= `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
const reportFolder = `reports/GEP_Report_${process.env.GEP_REPORT_STAMP}`;

export default defineConfig<GepOptions>({
  testDir: './tests',
  // Run once before / after all tests, not reported as tests (src/hooks). SIGN_IN_ONCE=true: sign in once per market
  // and save the session before the run, sign out (Gen Z) and remove it after; otherwise they do nothing.
  globalSetup: './src/hooks/globalSetup.ts',
  globalTeardown: './src/hooks/globalTeardown.ts',
  timeout: ENV.timeout,
  expect: {
    timeout: 10000,
  },
  // Tests share one account (and so one cart) per market, so they run one after another.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['list'],
    ['html', { outputFolder: `${reportFolder}/html`, open: 'never' }],
    ['monocart-reporter', { name: 'Automation Test Report', outputFile: `${reportFolder}/monocart/index.html` }],
    ['json', { outputFile: `${runFolder('test-results')}/results.json` }],
  ],

  use: {
    headless: ENV.headless,
    actionTimeout: 30000,
    navigationTimeout: ENV.timeout,
    screenshot: 'only-on-failure',
    video: ENV.video,
    trace: ENV.trace,
    ignoreHTTPSErrors: true,
  },

  projects: [
    // GEP: one project per market selected with MARKET in .env (default us), named <env>-<market>, e.g. qa-us.
    // The site URL comes from the test data database (market fixture), so there is no baseURL here.
    ...selectedMarketIds(testEnv).flatMap((marketId) => {
      const name = `${testEnv}-${marketId}`;
      const use = { ...desktopChrome, ...browserWindow, testEnv, marketId };
      return {
        name,
        // GEP tests place real orders: on prod only the tests tagged @prod-safe run.
        ...(testEnv === 'prod' ? { grep: /@prod-safe/ } : {}),
        use,
      };
    }),
  ],

  outputDir: runFolder('test-results'),
});
