import sql from 'mssql';
import type { MarketId, TestEnv } from './markets';

/**
 * Test data database (SQL Server, tables in db/schema.sql): the site profile of each market per environment
 * (`environments`) and the login users (`test_accounts`, passwords encrypted with ENCRYPTBYPASSPHRASE).
 * Connection settings come from .env: DB_SERVER, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_ENCRYPTION_KEY.
 * Only reads; one small pool per Playwright worker, opened on the first lookup.
 */

function read(name: string): string {
  return process.env[name]?.trim() ?? '';
}

/** True when .env points at a test data database (DB_SERVER is set). */
export function testDataDbConfigured(): boolean {
  return !!read('DB_SERVER');
}

/** The key that decrypts test_accounts.password_enc (the one used in the INSERT). */
export function testDataDbEncryptionKey(): string {
  return read('DB_ENCRYPTION_KEY');
}

let poolPromise: Promise<sql.ConnectionPool> | undefined;

function pool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    const port = Number(read('DB_PORT'));
    const connection = new sql.ConnectionPool({
      // localhost, or localhost\SQLEXPRESS for a named instance
      server: read('DB_SERVER'),
      ...(port ? { port } : {}),
      database: read('DB_NAME') || 'GEP_DB',
      user: read('DB_USER'),
      password: read('DB_PASSWORD'),
      options: {
        encrypt: read('DB_ENCRYPT') !== 'false',
        // A local SQL Server uses a self-signed certificate
        trustServerCertificate: read('DB_TRUST_SERVER_CERTIFICATE') !== 'false',
      },
      connectionTimeout: 10000,
      // Idle connections close, so a finished worker is not kept alive by the pool
      pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
    });
    poolPromise = connection.connect().catch((error: unknown) => {
      poolPromise = undefined;
      throw error;
    });
  }
  return poolPromise;
}

export type EnvironmentRow = {
  country: string;
  domain: string | null;
  region: string;
  baseUrl: string;
  dateFormat: string;
};

/** The `environments` row for a market on an environment, or undefined when there is none. */
export async function fetchEnvironment(env: TestEnv, market: MarketId): Promise<EnvironmentRow | undefined> {
  const result = await (await pool())
    .request()
    .input('env', sql.NVarChar(10), env)
    .input('market', sql.NVarChar(20), market)
    .query<EnvironmentRow>(
      `SELECT country, domain, region, base_url AS baseUrl, date_format AS dateFormat
       FROM environments
       WHERE env = @env AND market = @market`,
    );
  return result.recordset[0];
}

export type AccountRow = {
  username: string;
  /** null when password_enc is empty or DB_ENCRYPTION_KEY is not the key it was encrypted with */
  password: string | null;
};

/** Active `test_accounts` rows for a market on an environment with this user_key (normally exactly one). */
export async function fetchAccounts(env: TestEnv, market: MarketId, userKey: string, encryptionKey: string): Promise<AccountRow[]> {
  const result = await (await pool())
    .request()
    .input('env', sql.NVarChar(10), env)
    .input('market', sql.NVarChar(20), market)
    .input('userKey', sql.NVarChar(50), userKey)
    .input('key', sql.NVarChar(100), encryptionKey)
    .query<AccountRow>(
      // NVARCHAR: the passwords were encrypted as N'...' text
      `SELECT username, CONVERT(NVARCHAR(100), DECRYPTBYPASSPHRASE(@key, password_enc)) AS password
       FROM test_accounts
       WHERE env = @env AND market = @market AND user_key = @userKey AND active = 1`,
    );
  return result.recordset;
}
