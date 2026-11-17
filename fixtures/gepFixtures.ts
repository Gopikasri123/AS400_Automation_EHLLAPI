import { test as playwrightTest, expect, type BrowserContext } from '@playwright/test';
import fs from 'fs';
import type { Market, MarketId, TestEnv } from '../src/config/markets';
import { CHROME_PROFILE_DIR, ENV, authFileFor, resolveMarket } from '../src/config/env';
import { regionFor, type RegionBehaviour } from '../src/regions';
import { GepHeader } from '../src/components/GepHeader';
import { GepPopups } from '../src/components/GepPopups';
import { GepHomePage } from '../src/pages/GepHomePage';
import { GepLoginPage } from '../src/pages/GepLoginPage';
import { GepSearchResultsPage } from '../src/pages/GepSearchResultsPage';
import { GepProductDetailPage } from '../src/pages/GepProductDetailPage';
import { GepShoppingCartPage } from '../src/pages/GepShoppingCartPage';
import { GepShippingBillingPage } from '../src/pages/GepShippingBillingPage';
import { GepReviewOrderPage } from '../src/pages/GepReviewOrderPage';
import { GepOrderConfirmationPage } from '../src/pages/GepOrderConfirmationPage';
import { GepMyOrdersPage } from '../src/pages/GepMyOrdersPage';
import { GepOrderDetailsPage } from '../src/pages/GepOrderDetailsPage';
import { GepSessionFlow } from '../src/flows/GepSessionFlow';
import { GepCartFlow } from '../src/flows/GepCartFlow';
import { GepCheckoutFlow } from '../src/flows/GepCheckoutFlow';
import { GepOrderHistoryFlow } from '../src/flows/GepOrderHistoryFlow';
import { getMarketData, type MarketData } from '../data/marketData';

/** Set per Playwright project in playwright.config.ts (one project per environment + market). */
export type GepOptions = {
  testEnv: TestEnv;
  marketId: MarketId;
};

type GepFixtures = {
  // Market
  market: Market;
  marketData: MarketData;
  region: RegionBehaviour;
  // Components
  header: GepHeader;
  popups: GepPopups;
  // Pages
  homePage: GepHomePage;
  loginPage: GepLoginPage;
  searchResultsPage: GepSearchResultsPage;
  productDetailPage: GepProductDetailPage;
  shoppingCartPage: GepShoppingCartPage;
  shippingBillingPage: GepShippingBillingPage;
  reviewOrderPage: GepReviewOrderPage;
  orderConfirmationPage: GepOrderConfirmationPage;
  myOrdersPage: GepMyOrdersPage;
  orderDetailsPage: GepOrderDetailsPage;
  // Flows (Tosca reusable test step blocks)
  session: GepSessionFlow;
  cart: GepCartFlow;
  checkout: GepCheckoutFlow;
  orderHistory: GepOrderHistoryFlow;
};

/**
 * CHROME_PROFILE=true in .env: each test opens Chrome on the shared profile folder (.chrome-profile/), so the
 * browser cache survives between tests and pages load faster. Off (default): a fresh, empty browser per test.
 * Traces, screenshots and the page snapshot still come from Playwright; videos are recorded here.
 */
const persistentProfile = playwrightTest.extend({
  context: async ({ playwright, browserName, headless, launchOptions, viewport, ignoreHTTPSErrors, video }, use, testInfo) => {
    if (testInfo.config.workers > 1) {
      throw new Error('CHROME_PROFILE=true needs workers: 1 (one Chrome at a time can use the profile folder).');
    }
    const videoMode = typeof video === 'string' ? video : video.mode;
    const videoDir = testInfo.outputPath('video');
    const context: BrowserContext = await playwright[browserName].launchPersistentContext(CHROME_PROFILE_DIR, {
      ...launchOptions,
      headless,
      viewport,
      ignoreHTTPSErrors,
      ...(videoMode === 'off' ? {} : { recordVideo: { dir: videoDir } }),
    });
    await use(context);
    await context.close();

    const keepVideo = videoMode === 'on' || (videoMode !== 'off' && testInfo.status !== testInfo.expectedStatus);
    if (!keepVideo) {
      fs.rmSync(videoDir, { recursive: true, force: true });
      return;
    }
    for (const file of fs.existsSync(videoDir) ? fs.readdirSync(videoDir) : []) {
      testInfo.attachments.push({ name: 'video', path: `${videoDir}/${file}`, contentType: 'video/webm' });
    }
  },
  // The profile opens with one empty tab; use it instead of opening a second one.
  page: async ({ context }, use) => use(context.pages()[0] ?? (await context.newPage())),
});

const base = ENV.chromeProfile ? persistentProfile : playwrightTest;

/**
 * Fixtures only construct objects; nothing navigates until a test calls a flow or page method.
 * Tests import `test` and `expect` from here instead of from @playwright/test.
 */
export const test = base.extend<GepOptions & GepFixtures>({
  testEnv: ['qa', { option: true }],
  marketId: ['us', { option: true }],

  // SIGN_IN_ONCE=true: start from the session the auth setup saved for this market (cookies + local storage).
  // No file yet (e.g. the setup itself) = a fresh browser. The Chrome profile keeps its own cookies instead.
  storageState: async ({ testEnv, marketId, storageState }, use) => {
    const authFile = authFileFor(testEnv, marketId);
    use(ENV.signInOnce && fs.existsSync(authFile) ? authFile : storageState);
  },

  market: async ({ testEnv, marketId }, use) => use(await resolveMarket(marketId, testEnv)),
  marketData: async ({ testEnv, marketId }, use) => use(getMarketData(testEnv, marketId)),
  region: async ({ market }, use) => use(regionFor(market.region)),

  header: async ({ page }, use) => use(new GepHeader(page)),
  popups: async ({ page }, use) => use(new GepPopups(page)),

  homePage: async ({ page }, use) => use(new GepHomePage(page)),
  loginPage: async ({ page }, use) => use(new GepLoginPage(page)),
  searchResultsPage: async ({ page }, use) => use(new GepSearchResultsPage(page)),
  productDetailPage: async ({ page }, use) => use(new GepProductDetailPage(page)),
  shoppingCartPage: async ({ page }, use) => use(new GepShoppingCartPage(page)),
  shippingBillingPage: async ({ page }, use) => use(new GepShippingBillingPage(page)),
  reviewOrderPage: async ({ page }, use) => use(new GepReviewOrderPage(page)),
  orderConfirmationPage: async ({ page }, use) => use(new GepOrderConfirmationPage(page)),
  myOrdersPage: async ({ page }, use) => use(new GepMyOrdersPage(page)),
  orderDetailsPage: async ({ page }, use) => use(new GepOrderDetailsPage(page)),

  session: async ({ market, region, homePage, header, popups, loginPage }, use) =>
    use(new GepSessionFlow({ market, region, homePage, header, popups, loginPage })),
  cart: async ({ market, region, header, searchResultsPage, productDetailPage, shoppingCartPage }, use) =>
    use(new GepCartFlow({ market, region, header, searchResultsPage, productDetailPage, shoppingCartPage })),
  checkout: async ({ market, region, popups, shoppingCartPage, shippingBillingPage, reviewOrderPage, orderConfirmationPage }, use) =>
    use(new GepCheckoutFlow({ market, region, popups, shoppingCartPage, shippingBillingPage, reviewOrderPage, orderConfirmationPage })),
  orderHistory: async ({ header, popups, myOrdersPage }, use) => use(new GepOrderHistoryFlow({ header, popups, myOrdersPage })),
});

export { expect };
