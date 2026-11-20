-- =============================================================================
-- Regulatory Trade Reporting Validation: remove everything sql/setup.sql created.
-- Run as a user that holds ACCOUNTADMIN. Touches nothing else.
-- =============================================================================
-- Objects inside the database are owned by TRV_DEMO_ROLE, so drop them with that role first.
USE ROLE TRV_DEMO_ROLE;
DROP DATABASE IF EXISTS TRADE_REPORTING_DEMO;   -- tables, Dynamic Tables, anomaly model, search service, procedure, Git repository
DROP WAREHOUSE IF EXISTS TRV_WH;

USE ROLE ACCOUNTADMIN;
DROP INTEGRATION IF EXISTS TRV_GIT_API;
DROP ROLE IF EXISTS TRV_DEMO_ROLE;

-- Confirm nothing is left (each should return no rows):
SHOW DATABASES LIKE 'TRADE_REPORTING_DEMO';
SHOW WAREHOUSES LIKE 'TRV_WH';
SHOW INTEGRATIONS LIKE 'TRV_GIT_API';
SHOW ROLES LIKE 'TRV_DEMO_ROLE';
