import fs from 'fs';
import type { FullConfig } from '@playwright/test';
import { AUTH_DIR, ENV, authFileFor } from '../config/env';
import { gepMarketsOf, openGepBrowserSession } from './gepBrowserSession';

/**
 * Before the run (playwright.config.ts globalSetup), not a test.
 * SIGN_IN_ONCE=true: signs in once per market and saves the session (login + cookie consent) to .auth/<env>-<market>.json;
 * every test then starts from it (fixtures/gepFixtures.ts storageState). Off: does nothing, each test signs in itself.
 * A failed sign-in stops the run before any test starts, so no test places an order with a broken session.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  if (!ENV.signInOnce) return;
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  for (const run of gepMarketsOf(config)) {
    const name = `${run.testEnv}-${run.marketId}`;
    const authFile = authFileFor(run.testEnv, run.marketId);
    fs.rmSync(authFile, { force: true }); // never reuse a session saved by an earlier run
    console.log(`[global setup] ${name}: sign in once and save the session`);

    const gep = await openGepBrowserSession(run);
    try {
      await gep.session.openSite();
      if (!(await gep.header.isLoggedIn())) await gep.session.login();
      await gep.context.storageState({ path: authFile });
      console.log(`[global setup] ${name}: signed in, session saved`);
    } catch (error) {
      throw new Error(`[global setup] ${name}: sign-in failed, no tests were run.\n${(error as Error).message}`);
    } finally {
      await gep.close();
    }
  }
}
