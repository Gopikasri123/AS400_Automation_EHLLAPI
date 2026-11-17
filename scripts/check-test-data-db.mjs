// Checks the test data database (SQL Server) for TEST_ENV without running any test: can it connect,
// which markets have a site profile, and does every active user's password decrypt with DB_ENCRYPTION_KEY.
// Read-only, and never prints a password.  Usage: npm run db:check   (TEST_ENV from .env or the shell, default qa)
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });

const read = (name) => process.env[name]?.trim() ?? '';
const env = (read('TEST_ENV') || 'qa').toLowerCase();

if (!read('DB_SERVER')) {
  console.error('DB_SERVER is not set in .env: no test data database to check.');
  process.exit(1);
}

const port = Number(read('DB_PORT'));
const pool = new sql.ConnectionPool({
  server: read('DB_SERVER'),
  ...(port ? { port } : {}),
  database: read('DB_NAME') || 'GEP_DB',
  user: read('DB_USER'),
  password: read('DB_PASSWORD'),
  options: {
    encrypt: read('DB_ENCRYPT') !== 'false',
    trustServerCertificate: read('DB_TRUST_SERVER_CERTIFICATE') !== 'false',
  },
  connectionTimeout: 10000,
});

let problems = 0;
try {
  await pool.connect();
  console.log(`Connected to ${read('DB_SERVER')} / ${read('DB_NAME') || 'GEP_DB'} as ${read('DB_USER')}. TEST_ENV=${env}\n`);

  const environments = await pool
    .request()
    .input('env', sql.NVarChar(10), env)
    .query('SELECT market, country, domain, region, base_url, date_format FROM environments WHERE env = @env ORDER BY market');
  console.log(`environments (${environments.recordset.length} rows)`);
  console.table(environments.recordset);
  if (!environments.recordset.length) problems++;

  const accounts = await pool
    .request()
    .input('env', sql.NVarChar(10), env)
    .input('key', sql.NVarChar(100), read('DB_ENCRYPTION_KEY'))
    .query(
      `SELECT market, user_key, username,
              CASE WHEN CONVERT(NVARCHAR(100), DECRYPTBYPASSPHRASE(@key, password_enc)) IS NULL THEN 'NO' ELSE 'yes' END AS password_decrypts
       FROM test_accounts WHERE env = @env AND active = 1 ORDER BY market, user_key`,
    );
  console.log(`\nactive test_accounts (${accounts.recordset.length} rows)`);
  console.table(accounts.recordset);

  if (!read('DB_ENCRYPTION_KEY')) {
    console.log('DB_ENCRYPTION_KEY is not set in .env, so no password can be decrypted.');
    problems++;
  }
  for (const row of accounts.recordset) {
    if (row.password_decrypts !== 'yes') {
      console.log(`Password of ${row.market} / ${row.user_key} does not decrypt: check DB_ENCRYPTION_KEY.`);
      problems++;
    }
  }
  for (const { market } of environments.recordset) {
    if (!accounts.recordset.some((row) => row.market === market && row.user_key === 'default')) {
      console.log(`No active 'default' user for ${env}/${market}.`);
      problems++;
    }
  }
} catch (error) {
  console.error(`Test data database check failed: ${error.message}`);
  problems++;
} finally {
  await pool.close();
}

console.log(problems ? `\n${problems} problem(s) found.` : '\nAll good.');
process.exit(problems ? 1 : 0);
