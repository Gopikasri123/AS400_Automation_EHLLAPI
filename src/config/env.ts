import dotenv from 'dotenv';
import path from 'path';
import {
  DEFAULT_MARKET,
  DEFAULT_TEST_ENV,
  LEGACY_MARKET_IDS,
  MARKET_IDS,
  QA_PROFILES,
  TEST_ENVS,
  envPrefixFor,
  isMarketId,
  isTestEnv,
  type DateFormat,
  type Market,
  type MarketId,
  type TestEnv,
} from './markets';
import type { RegionName } from '../regions/RegionBehaviour';
import { fetchAccounts, fetchEnvironment, testDataDbConfigured, testDataDbEncryptionKey } from './testDataDb';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env'), quiet: true });

function read(name: string): string {
  return process.env[name]?.trim() ?? '';
}

/** Run settings from .env (or the CI environment). */
export const ENV = {
  timeout: Number(read('TIMEOUT')) || 60000,
  // Headed locally so the run can be watched; headless on CI or with HEADLESS=true.
  headless: !!process.env.CI || read('HEADLESS') === 'true',
  // CHROME_PROFILE=true: GEP tests reuse one Chrome profile folder (cache kept between tests) instead of a fresh browser.
  chromeProfile: read('CHROME_PROFILE') === 'true',
  // SIGN_IN_ONCE=true: sign in once per market before the first test (auth setup) and sign out after the last one
  // (auth teardown); the tests start from that saved session instead of signing out and in each time.
  signInOnce: read('SIGN_IN_ONCE') === 'true',
  // VIDEO (off | on | retain-on-failure | on-first-retry). Default: retain-on-failure on CI, off locally, because
  // live video encoding slows a run a lot on low-end laptops. Traces and screenshots of failures are still kept.
  video: (read('VIDEO') || (process.env.CI ? 'retain-on-failure' : 'off')) as
    'off' | 'on' | 'retain-on-failure' | 'on-first-retry',
  // TRACE (same values). Default: retain-on-failure on CI, off locally: recording a trace snapshots the page on every
  // action. A failed test still gets its screenshot and page snapshot (error-context.md, used by the heal script).
  trace: (read('TRACE') || (process.env.CI ? 'retain-on-failure' : 'off')) as
    'off' | 'on' | 'retain-on-failure' | 'on-first-retry',
};

/** Folder of the saved login sessions (git-ignored; holds login cookies). */
export const AUTH_DIR = path.resolve(__dirname, '..', '..', '.auth');

/** Saved session (cookies + local storage) of one environment + market, written by the auth setup. */
export function authFileFor(env: TestEnv, marketId: MarketId): string {
  return path.join(AUTH_DIR, `${env}-${marketId}.json`);
}

/** Folder of the shared Chrome profile (git-ignored; holds cookies). Delete it to start fresh. */
export const CHROME_PROFILE_DIR = path.resolve(__dirname, '..', '..', '.chrome-profile');

/**
 * Environment to run: TEST_ENV in .env or the shell (default qa). One environment per run;
 * run QA, UAT and prod side by side as separate runs. Prod needs ALLOW_PROD=true, because GEP tests place real orders.
 */
export function selectedTestEnv(): TestEnv {
  const env = (read('TEST_ENV') || DEFAULT_TEST_ENV).toLowerCase();
  if (!isTestEnv(env)) {
    throw new Error(`Unknown TEST_ENV "${env}". Use one of: ${TEST_ENVS.join(', ')}.`);
  }
  if (env === 'prod' && read('ALLOW_PROD') !== 'true') {
    throw new Error('TEST_ENV=prod runs on the live sites. Set ALLOW_PROD=true to run the @prod-safe tests there.');
  }
  return env;
}

/** Markets to run: MARKET in .env, comma-separated for several (default us). The old ids (us-qa, ...) still mean QA. */
export function selectedMarketIds(env: TestEnv = selectedTestEnv()): MarketId[] {
  const ids = (read('MARKET') || DEFAULT_MARKET).split(',').map((id) => id.trim()).filter(Boolean);
  return ids.map((id) => {
    const legacy = LEGACY_MARKET_IDS[id];
    if (legacy) {
      if (env !== 'qa') throw new Error(`MARKET "${id}" is a QA market. With TEST_ENV=${env} use MARKET=${legacy}.`);
      return legacy;
    }
    if (!isMarketId(id)) {
      throw new Error(`Unknown MARKET "${id}". Use one of: ${MARKET_IDS.join(', ')}.`);
    }
    return id;
  });
}

const warned = new Set<string>();

function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[test data] ${message}`);
}

/**
 * Runs a lookup in the test data database. Returns undefined when there is no database to ask:
 * DB_SERVER not set, or (on QA only) the database cannot be reached, so the QA values in code and .env are used.
 */
async function askDatabase<T>(env: TestEnv, what: string, lookup: () => Promise<T>): Promise<{ value: T } | undefined> {
  if (!testDataDbConfigured()) return undefined;
  try {
    return { value: await lookup() };
  } catch (error) {
    const message = `Could not read ${what} from the test data database: ${(error as Error).message}`;
    if (env !== 'qa') throw new Error(message);
    warnOnce(`${message}. Using the QA values in code and .env instead.`);
    return undefined;
  }
}

const REGIONS: readonly RegionName[] = ['genx', 'geny', 'genz'];
const DATE_FORMATS: readonly DateFormat[] = ['mm/dd/yyyy', 'dd/mm/yyyy'];

function checked<T extends string>(value: string, allowed: readonly T[], column: string, where: string): T {
  const normalised = value.trim().toLowerCase();
  if (!(allowed as readonly string[]).includes(normalised)) {
    throw new Error(`environments.${column} is "${value}" for ${where}. Use one of: ${allowed.join(', ')}.`);
  }
  return normalised as T;
}

async function loadMarket(id: MarketId, env: TestEnv): Promise<Market> {
  const where = `${env}/${id}`;
  const envPrefix = envPrefixFor(id, env);
  const fromDb = await askDatabase(env, `the site profile for ${where}`, () => fetchEnvironment(env, id));

  let profile: Omit<Market, 'env' | 'envPrefix'>;
  if (fromDb) {
    const row = fromDb.value;
    if (!row) throw new Error(`No row for env '${env}', market '${id}' in the environments table of the test data database.`);
    profile = {
      id,
      baseUrl: row.baseUrl,
      country: row.country,
      region: checked(row.region, REGIONS, 'region', where),
      domain: row.domain ?? '',
      dateFormat: checked(row.dateFormat, DATE_FORMATS, 'date_format', where),
    };
  } else {
    if (env !== 'qa') {
      throw new Error(`TEST_ENV=${env} needs the test data database (DB_SERVER in .env): only QA has built-in site profiles.`);
    }
    profile = QA_PROFILES[id];
  }
  // <PREFIX>_BASE_URL in .env still overrides the URL, e.g. US_QA_BASE_URL
  return { ...profile, env, envPrefix, baseUrl: read(`${envPrefix}_BASE_URL`) || profile.baseUrl };
}

const markets = new Map<string, Promise<Market>>();

/** The market profile for an environment: from the `environments` table, read once per worker. */
export function resolveMarket(id: MarketId, env: TestEnv): Promise<Market> {
  const key = `${env}/${id}`;
  let market = markets.get(key);
  if (!market) {
    market = loadMarket(id, env);
    markets.set(key, market);
  }
  return market;
}

export type Credentials = { username: string; password: string };

/** user_key of the user a test gets when it does not ask for a specific one. */
export const DEFAULT_USER_KEY = 'default';

async function loadCredentials(market: Market, userKey: string): Promise<Credentials> {
  const where = `${market.env}/${market.id}`;
  const encryptionKey = testDataDbEncryptionKey();
  if (testDataDbConfigured() && !encryptionKey) {
    throw new Error('DB_ENCRYPTION_KEY is not set in .env: it decrypts the passwords in test_accounts.');
  }
  const fromDb = await askDatabase(market.env, `the '${userKey}' user for ${where}`, () =>
    fetchAccounts(market.env, market.id, userKey, encryptionKey),
  );

  if (fromDb) {
    const rows = fromDb.value;
    if (rows.length === 0) throw new Error(`No active user '${userKey}' for ${where} in test_accounts.`);
    if (rows.length > 1) {
      throw new Error(`${rows.length} active users '${userKey}' for ${where} in test_accounts. Set all but one to active = 0.`);
    }
    const [{ username, password }] = rows;
    if (!password) {
      throw new Error(
        `The password of user '${userKey}' for ${where} could not be decrypted. Check that DB_ENCRYPTION_KEY is the key used in the INSERT.`,
      );
    }
    return { username, password };
  }

  // No database: the QA default user from .env, <PREFIX>_APP_USERNAME (e.g. US_QA_APP_USERNAME), then APP_USERNAME.
  if (userKey !== DEFAULT_USER_KEY) {
    throw new Error(`User '${userKey}' for ${where} can only come from test_accounts, but the test data database is not available.`);
  }
  const lookup = (name: string): string => {
    const value = read(`${market.envPrefix}_${name}`) || read(name);
    if (!value) throw new Error(`No ${name} for ${where}. Set up the test data database, or ${market.envPrefix}_${name} in .env (see .env.example).`);
    return value;
  };
  return { username: lookup('APP_USERNAME'), password: lookup('APP_PASSWORD') };
}

const credentials = new Map<string, Promise<Credentials>>();

/**
 * Login for a market, never from code: the active `test_accounts` row for the market's env + market + user_key
 * (default 'default'). Without a database, QA falls back to <PREFIX>_APP_USERNAME / _APP_PASSWORD in .env.
 */
export function credentialsFor(market: Market, userKey: string = DEFAULT_USER_KEY): Promise<Credentials> {
  const key = `${market.env}/${market.id}/${userKey}`;
  let login = credentials.get(key);
  if (!login) {
    login = loadCredentials(market, userKey);
    credentials.set(key, login);
  }
  return login;
}
