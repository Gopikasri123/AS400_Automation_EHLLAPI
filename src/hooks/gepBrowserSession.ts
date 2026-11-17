import { chromium, devices, type BrowserContext, type FullConfig, type Page } from '@playwright/test';
import { CHROME_PROFILE_DIR, ENV, resolveMarket } from '../config/env';
import type { MarketId, TestEnv } from '../config/markets';
import { regionFor } from '../regions';
import { GepHeader } from '../components/GepHeader';
import { GepPopups } from '../components/GepPopups';
import { GepHomePage } from '../pages/GepHomePage';
import { GepLoginPage } from '../pages/GepLoginPage';
import { GepSessionFlow } from '../flows/GepSessionFlow';

/**
 * Browser + session flow for the global setup / teardown (src/hooks), which run before and after the whole run,
 * outside any test, so they cannot use the test fixtures. Opens the browser the same way the tests do
 * (playwright.config.ts): headed and maximised locally, 1920x1080 headless; CHROME_PROFILE=true uses the shared profile.
 */
export type GepMarketRun = { testEnv: TestEnv; marketId: MarketId };

/** Every <env>-<market> GEP project of this run, read from the project options in playwright.config.ts. */
export function gepMarketsOf(config: FullConfig): GepMarketRun[] {
  const seen = new Map<string, GepMarketRun>();
  for (const project of config.projects) {
    const use = project.use as Partial<GepMarketRun>;
    if (use.testEnv && use.marketId) seen.set(`${use.testEnv}-${use.marketId}`, { testEnv: use.testEnv, marketId: use.marketId });
  }
  return [...seen.values()];
}

export type GepBrowserSession = {
  page: Page;
  context: BrowserContext;
  session: GepSessionFlow;
  header: GepHeader;
  regionName: string;
  close: () => Promise<void>;
};

export async function openGepBrowserSession(run: GepMarketRun, storageState?: string): Promise<GepBrowserSession> {
  const { deviceScaleFactor: _scale, ...desktopChrome } = devices['Desktop Chrome'];
  const window = ENV.headless
    ? { viewport: { width: 1920, height: 1080 } }
    : { viewport: null, args: ['--start-maximized'] };
  const contextOptions = {
    userAgent: desktopChrome.userAgent,
    viewport: window.viewport,
    ignoreHTTPSErrors: true,
  };

  let context: BrowserContext;
  let closeBrowser: () => Promise<void>;
  if (ENV.chromeProfile) {
    context = await chromium.launchPersistentContext(CHROME_PROFILE_DIR, {
      ...contextOptions,
      headless: ENV.headless,
      args: 'args' in window ? window.args : [],
    });
    closeBrowser = () => context.close();
  } else {
    const browser = await chromium.launch({ headless: ENV.headless, args: 'args' in window ? window.args : [] });
    context = await browser.newContext({ ...contextOptions, ...(storageState ? { storageState } : {}) });
    closeBrowser = () => browser.close();
  }
  context.setDefaultTimeout(30000);
  context.setDefaultNavigationTimeout(ENV.timeout);
  const page = context.pages()[0] ?? (await context.newPage());

  const market = await resolveMarket(run.marketId, run.testEnv);
  const region = regionFor(market.region);
  const header = new GepHeader(page);
  const session = new GepSessionFlow({
    market,
    region,
    homePage: new GepHomePage(page),
    header,
    popups: new GepPopups(page),
    loginPage: new GepLoginPage(page),
  });
  return { page, context, session, header, regionName: market.region, close: closeBrowser };
}
