-- Test data database for the GEP tests (SQL Server). Run once in SSMS against your database (e.g. GEP_DB).
-- Credentials never go in this file or in git: insert the users by hand (see "Users" below).

-- One row per environment + market: which site, country and Gen region the tests use.
CREATE TABLE environments (
    env          NVARCHAR(10)  NOT NULL,             -- qa / uat / prod   (TEST_ENV)
    market       NVARCHAR(20)  NOT NULL,             -- us / uk-dental / uk-medical   (MARKET)
    country      NVARCHAR(5)   NOT NULL,             -- US / UK
    domain       NVARCHAR(20)  NOT NULL DEFAULT '',  -- Dental / Medical / ''
    region       NVARCHAR(10)  NOT NULL,             -- genx / geny / genz
    base_url     NVARCHAR(200) NOT NULL,
    date_format  NVARCHAR(10)  NOT NULL,             -- mm/dd/yyyy or dd/mm/yyyy
    CONSTRAINT PK_environments PRIMARY KEY (env, market)
);
GO

-- Login users. A test signs in as user_key 'default' unless it asks for another one: session.login('admin').
CREATE TABLE test_accounts (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    env           NVARCHAR(10)    NOT NULL,
    market        NVARCHAR(20)    NOT NULL,
    user_key      NVARCHAR(50)    NOT NULL CONSTRAINT DF_accounts_user_key DEFAULT N'default',
    username      NVARCHAR(100)   NOT NULL,
    password_enc  VARBINARY(8000) NULL,              -- ENCRYPTBYPASSPHRASE(<DB_ENCRYPTION_KEY>, N'<password>')
    active        BIT             NOT NULL DEFAULT 1,
    CONSTRAINT FK_accounts_env FOREIGN KEY (env, market) REFERENCES environments (env, market)
);
GO

-- Only one active user per env + market + user_key, so a lookup always finds exactly one.
CREATE UNIQUE INDEX UX_one_active_user
    ON test_accounts (env, market, user_key)
    WHERE active = 1;
GO

-- QA sites (same values as QA_PROFILES in src/config/markets.ts)
INSERT INTO environments (env, market, country, domain, region, base_url, date_format) VALUES
(N'qa', N'us',         N'US', N'',        N'genx', N'https://www.us.qa.eschein.com/en-us', N'mm/dd/yyyy'),
(N'qa', N'uk-dental',  N'UK', N'Dental',  N'genx', N'https://www.uk.qa.eschein.com/',      N'dd/mm/yyyy'),
(N'qa', N'uk-medical', N'UK', N'Medical', N'genx', N'https://www.uk.qa.eschein.com/',      N'dd/mm/yyyy');
GO

-- Users: run by hand, filling in the values. Keep DECLARE and INSERT in one batch (no GO between them),
-- and always encrypt N'...' text: the tests decrypt as NVARCHAR.
--
-- DECLARE @key NVARCHAR(100) = N'<DB_ENCRYPTION_KEY>';
-- INSERT INTO test_accounts (env, market, user_key, username, password_enc) VALUES
-- (N'qa', N'us', N'default', N'<username>', ENCRYPTBYPASSPHRASE(@key, N'<password>'));

-- Read-only login for the automation (DB_USER / DB_PASSWORD in .env). Needs SQL Server Authentication mode.
--
-- USE master;  CREATE LOGIN gep_automation WITH PASSWORD = N'<strong password>';
-- USE GEP_DB;  CREATE USER gep_automation FOR LOGIN gep_automation;
-- GRANT SELECT ON environments TO gep_automation;  GRANT SELECT ON test_accounts TO gep_automation;
