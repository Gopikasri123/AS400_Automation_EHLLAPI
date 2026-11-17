import type { RegionName } from '../regions/RegionBehaviour';

export type MarketId = 'us' | 'uk-dental' | 'uk-medical';

/** Which copy of the sites the tests run against: TEST_ENV in .env (default qa). */
export type TestEnv = 'qa' | 'uat' | 'prod';

export const TEST_ENVS: readonly TestEnv[] = ['qa', 'uat', 'prod'];

export type DateFormat = 'mm/dd/yyyy' | 'dd/mm/yyyy';

/**
 * A site configuration the tests run against: one market on one environment. Replaces the Tosca test
 * configuration parameters {CP[Country]}, the "Gen" condition and {CP[Domain]}.
 * Filled from the `environments` table in the test data database (src/config/testDataDb.ts),
 * or from QA_PROFILES below when no database is configured.
 */
export type Market = {
  id: MarketId;
  env: TestEnv;
  baseUrl: string;
  /** Tosca: {CP[Country]} */
  country: string;
  /** Tosca "Gen" condition from TDM: which UI variant the site uses */
  region: RegionName;
  /** Tosca: {CP[Domain]}; only the UK site has the Medical/Dental domain picker */
  domain: string;
  /** How the site shows dates in input fields */
  dateFormat: DateFormat;
  /** Prefix of this market's fallback keys in .env: <MARKET>_<ENV>, e.g. US_QA -> US_QA_APP_USERNAME, US_QA_BASE_URL */
  envPrefix: string;
};

/** QA site profiles, used when the test data database is not configured (same values as its QA rows). */
export const QA_PROFILES: Record<MarketId, Omit<Market, 'env' | 'envPrefix'>> = {
  us: {
    id: 'us',
    baseUrl: 'https://www.us.qa.eschein.com/en-us',
    country: 'US',
    region: 'genx',
    domain: '',
    dateFormat: 'mm/dd/yyyy',
  },
  'uk-dental': {
    id: 'uk-dental',
    baseUrl: 'https://www.uk.qa.eschein.com/',
    country: 'UK',
    region: 'genx',
    domain: 'Dental',
    dateFormat: 'dd/mm/yyyy',
  },
  'uk-medical': {
    id: 'uk-medical',
    baseUrl: 'https://www.uk.qa.eschein.com/',
    country: 'UK',
    region: 'genx',
    domain: 'Medical',
    dateFormat: 'dd/mm/yyyy',
  },
};

export const MARKET_IDS = Object.keys(QA_PROFILES) as MarketId[];

export const DEFAULT_MARKET: MarketId = 'us';
export const DEFAULT_TEST_ENV: TestEnv = 'qa';

/** Market ids from before TEST_ENV existed, still accepted in MARKET (they all meant QA). */
export const LEGACY_MARKET_IDS: Record<string, MarketId> = {
  'us-qa': 'us',
  'uk-dental-qa': 'uk-dental',
  'uk-medical-qa': 'uk-medical',
};

export function isMarketId(value: string): value is MarketId {
  return value in QA_PROFILES;
}

export function isTestEnv(value: string): value is TestEnv {
  return (TEST_ENVS as readonly string[]).includes(value);
}

/** .env key prefix for a market on an environment, e.g. ('uk-dental', 'qa') -> UK_DENTAL_QA */
export function envPrefixFor(id: MarketId, env: TestEnv): string {
  return `${id}_${env}`.replace(/-/g, '_').toUpperCase();
}
