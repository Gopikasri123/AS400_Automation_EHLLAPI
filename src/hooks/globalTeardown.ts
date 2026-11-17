import fs from 'fs';
import type { FullConfig } from '@playwright/test';
import { ENV, authFileFor, resolveMarket } from '../config/env';
import { gepMarketsOf, openGepBrowserSession } from './gepBrowserSession';

/**
 * After the run (playwright.config.ts globalTeardown), not a test.
 * SIGN_IN_ONCE=true: signs out of the shared session (Gen Z only; Tosca: Gen X / Y just close the browser)
 * and deletes the saved session file. A failed sign-out is reported but does not change the test results.
 */
export default async function globalTeardown(config: FullConfig): Promise<void> {
  if (!ENV.signInOnce) return;

  for (const run of gepMarketsOf(config)) {
    const name = `${run.testEnv}-${run.marketId}`;
    const authFile = authFileFor(run.testEnv, run.marketId);
    try {
      if (!fs.existsSync(authFile)) continue;
      // Gen X / Y: no browser is opened at all, only the saved session is removed.
      if ((await resolveMarket(run.marketId, run.testEnv)).region !== 'genz') continue;
      console.log(`[global teardown] ${name}: sign out`);
      const gep = await openGepBrowserSession(run, authFile);
      try {
        await gep.session.openSite();
        await gep.session.signOut();
      } finally {
        await gep.close();
      }
    } catch (error) {
      console.warn(`[global teardown] ${name}: sign-out failed: ${(error as Error).message}`);
    } finally {
      fs.rmSync(authFile, { force: true });
      console.log(`[global teardown] ${name}: saved session removed`);
    }
  }
}
