-- =============================================================================
-- Regulatory Trade Reporting Validation (CAT and CAIS): Snowflake setup
-- Synthetic data only (fictional broker-dealer "Northwind Securities"). Schemas and error
-- codes are illustrative, not the official CAT or CAIS specifications. Not regulatory advice.
--
-- Run top to bottom in a Snowsight SQL worksheet (about 4 minutes on an XSMALL warehouse).
-- Requirements (see README): Enterprise Edition or higher (data metric functions), Cortex AI
-- functions in your region or cross-region inference, and a role that can create roles,
-- warehouses, databases, and API integrations.
--
-- Creates (and sql/cleanup.sql drops):
--   role        TRV_DEMO_ROLE (owns everything below; the app connects with it)
--   warehouse   TRV_WH (XSMALL, AUTO_SUSPEND = 60)
--   database    TRADE_REPORTING_DEMO (schemas SRC, RPT)
--   integration TRV_GIT_API (read-only access to the public example repository)
-- It changes nothing that already exists.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Part 1. Account-level objects (ACCOUNTADMIN)
-- -----------------------------------------------------------------------------
USE ROLE ACCOUNTADMIN;

CREATE ROLE IF NOT EXISTS TRV_DEMO_ROLE COMMENT = 'Trade Reporting Validation example: object owner and app role';
GRANT ROLE TRV_DEMO_ROLE TO ROLE SYSADMIN;
SET my_user = CURRENT_USER();
GRANT ROLE TRV_DEMO_ROLE TO USER IDENTIFIER($my_user);

CREATE WAREHOUSE IF NOT EXISTS TRV_WH
  WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE
  COMMENT = 'Trade Reporting Validation example';
GRANT OWNERSHIP ON WAREHOUSE TRV_WH TO ROLE TRV_DEMO_ROLE;

CREATE DATABASE IF NOT EXISTS TRADE_REPORTING_DEMO COMMENT = 'Trade Reporting Validation example (synthetic data)';
GRANT OWNERSHIP ON DATABASE TRADE_REPORTING_DEMO TO ROLE TRV_DEMO_ROLE;

-- Cortex AI functions and Cortex Search.
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE TRV_DEMO_ROLE;
-- Data metric functions.
GRANT DATABASE ROLE SNOWFLAKE.DATA_METRIC_USER TO ROLE TRV_DEMO_ROLE;
GRANT EXECUTE DATA METRIC FUNCTION ON ACCOUNT TO ROLE TRV_DEMO_ROLE;

-- Read-only access to the public GitHub repository that holds the synthetic CSVs.
CREATE API INTEGRATION IF NOT EXISTS TRV_GIT_API
  API_PROVIDER = git_https_api
  API_ALLOWED_PREFIXES = ('https://github.com/sfc-gh-ooral/')
  ENABLED = TRUE
  COMMENT = 'Trade Reporting Validation example: public repository, read only';
GRANT USAGE ON INTEGRATION TRV_GIT_API TO ROLE TRV_DEMO_ROLE;

-- -----------------------------------------------------------------------------
-- Part 2. Everything else runs as the least-privilege owner role
-- -----------------------------------------------------------------------------
USE ROLE TRV_DEMO_ROLE;
USE WAREHOUSE TRV_WH;
USE DATABASE TRADE_REPORTING_DEMO;
CREATE SCHEMA IF NOT EXISTS SRC COMMENT = 'Books, reporting feed, submissions, and regulator feedback (synthetic)';
CREATE SCHEMA IF NOT EXISTS RPT COMMENT = 'Validation pipeline, repair workflow, and evidence';

-- 2a. Load the synthetic data ---------------------------------------------------
USE SCHEMA SRC;
CREATE OR REPLACE GIT REPOSITORY TRV_REPO
  API_INTEGRATION = TRV_GIT_API
  ORIGIN = 'https://github.com/sfc-gh-ooral/sfguide-trade-reporting-validation.git';
CREATE STAGE IF NOT EXISTS TRV_DATA COMMENT = 'Synthetic CSVs copied from the repository';
COPY FILES INTO @TRV_DATA FROM @TRV_REPO/branches/main/data/ PATTERN = '.*[.]csv';
CREATE OR REPLACE FILE FORMAT TRV_CSV TYPE = CSV PARSE_HEADER = TRUE FIELD_OPTIONALLY_ENCLOSED_BY = '"' EMPTY_FIELD_AS_NULL = TRUE ERROR_ON_COLUMN_COUNT_MISMATCH = FALSE;

-- Books (order management and execution records).
CREATE OR REPLACE TABLE ORDERS (order_id VARCHAR, trade_date DATE, source_system VARCHAR, desk VARCHAR, account_id VARCHAR,
  symbol VARCHAR, side VARCHAR, quantity NUMBER, order_type VARCHAR, order_ts TIMESTAMP_NTZ);
CREATE OR REPLACE TABLE EXECUTIONS (execution_id VARCHAR, order_id VARCHAR, trade_date DATE, exec_ts TIMESTAMP_NTZ, symbol VARCHAR,
  side VARCHAR, quantity NUMBER, price NUMBER(12,2), source_system VARCHAR, desk VARCHAR, account_id VARCHAR);
-- Reporting feed: one row per order lifecycle event, as built for CAT (simplified, illustrative).
CREATE OR REPLACE TABLE ORDER_EVENTS (event_id VARCHAR, order_id VARCHAR, trade_date DATE, event_type VARCHAR, event_ts TIMESTAMP_NTZ(3),
  step_seq NUMBER, source_system VARCHAR, desk VARCHAR, firm_designated_id VARCHAR, symbol VARCHAR, side VARCHAR, quantity NUMBER,
  price NUMBER(12,2), destination VARCHAR, routed_order_id VARCHAR, exec_ref VARCHAR);
CREATE OR REPLACE TABLE CAT_SUBMISSIONS (event_id VARCHAR, trade_date DATE, file_id VARCHAR, submitted_ts TIMESTAMP_NTZ);
CREATE OR REPLACE TABLE CAT_FEEDBACK (feedback_id VARCHAR, event_id VARCHAR, order_id VARCHAR, trade_date DATE, file_id VARCHAR,
  error_code VARCHAR, error_text VARCHAR, received_ts TIMESTAMP_NTZ);
-- Customer and account records (CAIS).
CREATE OR REPLACE TABLE CUSTOMER_RECORDS (record_id VARCHAR, account_id VARCHAR, customer_id VARCHAR, name VARCHAR, dob DATE,
  tin_last4 VARCHAR, address VARCHAR, city VARCHAR, state VARCHAR, postal_code VARCHAR, large_trader_id VARCHAR, large_trader_flag BOOLEAN);
CREATE OR REPLACE TABLE ACCOUNTS (account_id VARCHAR, account_type VARCHAR, open_date DATE, branch VARCHAR);
CREATE OR REPLACE TABLE CAIS_SUBMISSIONS (record_id VARCHAR, account_id VARCHAR, submitted_ts TIMESTAMP_NTZ, file_id VARCHAR);
CREATE OR REPLACE TABLE CAIS_FEEDBACK (feedback_id VARCHAR, record_id VARCHAR, account_id VARCHAR, error_code VARCHAR, error_text VARCHAR, received_ts TIMESTAMP_NTZ);
CREATE OR REPLACE TABLE DAILY_STATS_HISTORY (trade_date DATE, source_system VARCHAR, events NUMBER, rejects NUMBER);

COPY INTO ORDERS              FROM @TRV_DATA/orders.csv              FILE_FORMAT = TRV_CSV MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
COPY INTO EXECUTIONS          FROM @TRV_DATA/executions.csv          FILE_FORMAT = TRV_CSV MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
COPY INTO ORDER_EVENTS        FROM @TRV_DATA/order_events.csv        FILE_FORMAT = TRV_CSV MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
COPY INTO CAT_SUBMISSIONS     FROM @TRV_DATA/cat_submissions.csv     FILE_FORMAT = TRV_CSV MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
COPY INTO CAT_FEEDBACK        FROM @TRV_DATA/cat_feedback.csv        FILE_FORMAT = TRV_CSV MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
COPY INTO CUSTOMER_RECORDS    FROM @TRV_DATA/customer_records.csv    FILE_FORMAT = TRV_CSV MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
COPY INTO ACCOUNTS            FROM @TRV_DATA/accounts.csv            FILE_FORMAT = TRV_CSV MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
COPY INTO CAIS_SUBMISSIONS    FROM @TRV_DATA/cais_submissions.csv    FILE_FORMAT = TRV_CSV MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
COPY INTO CAIS_FEEDBACK       FROM @TRV_DATA/cais_feedback.csv       FILE_FORMAT = TRV_CSV MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
COPY INTO DAILY_STATS_HISTORY FROM @TRV_DATA/daily_stats_history.csv FILE_FORMAT = TRV_CSV MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;

-- Scheduled data metric functions on the reporting feed: Snowflake records them after every load
-- (results in SNOWFLAKE.LOCAL.DATA_QUALITY_MONITORING_RESULTS).
ALTER TABLE ORDER_EVENTS SET DATA_METRIC_SCHEDULE = 'TRIGGER_ON_CHANGES';
ALTER TABLE ORDER_EVENTS ADD DATA METRIC FUNCTION SNOWFLAKE.CORE.NULL_COUNT ON (firm_designated_id);
ALTER TABLE ORDER_EVENTS ADD DATA METRIC FUNCTION SNOWFLAKE.CORE.DUPLICATE_COUNT ON (event_id);

-- 2b. Rule library, business clock, and workflow tables ------------------------------------
USE SCHEMA RPT;
CREATE OR REPLACE TABLE RULES (rule_id VARCHAR, version VARCHAR, name VARCHAR, severity VARCHAR, error_code VARCHAR, method VARCHAR, description VARCHAR);
COPY INTO RULES FROM @SRC.TRV_DATA/rules.csv FILE_FORMAT = SRC.TRV_CSV MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;

-- The synthetic data set is frozen at this business time; deadlines and ages count from it.
CREATE OR REPLACE TABLE CONFIG (as_of TIMESTAMP_NTZ, timezone VARCHAR);
INSERT INTO CONFIG VALUES ('2026-10-30 16:00:00', 'America/New_York');

CREATE OR REPLACE TABLE REPAIRS (feedback_id VARCHAR, regime VARCHAR, status VARCHAR, assignee VARCHAR, repair_note VARCHAR,
  updated_by VARCHAR, updated_ts TIMESTAMP_LTZ);
INSERT INTO REPAIRS (feedback_id, regime, status) SELECT feedback_id, 'CAT', 'Open' FROM SRC.CAT_FEEDBACK;
INSERT INTO REPAIRS (feedback_id, regime, status) SELECT feedback_id, 'CAIS', 'Open' FROM SRC.CAIS_FEEDBACK;
CREATE OR REPLACE TABLE APPROVAL_LOG (action VARCHAR, object_type VARCHAR, object_ids VARCHAR, detail VARCHAR, ai_assisted BOOLEAN,
  actor VARCHAR, ts TIMESTAMP_LTZ);
CREATE OR REPLACE TABLE CANONICAL_CUSTOMERS (canonical_id VARCHAR, record_ids VARCHAR, name VARCHAR, dob DATE, address VARCHAR,
  city VARCHAR, state VARCHAR, postal_code VARCHAR, customer_id VARCHAR, approved_by VARCHAR, approved_ts TIMESTAMP_LTZ);
CREATE OR REPLACE TABLE RUN_LOG (run_id VARCHAR, trade_date DATE, rule_id VARCHAR, rule_version VARCHAR, records_checked NUMBER,
  failures NUMBER, query_id VARCHAR, run_ts TIMESTAMP_LTZ, run_by VARCHAR, trigger_type VARCHAR);

-- 2c. Validation pipeline (Dynamic Tables) -----------------------------------------------
-- Every pre-submission check, one row per failing record.
CREATE OR REPLACE DYNAMIC TABLE CHECK_FAILURES
  TARGET_LAG = '1 hour' WAREHOUSE = TRV_WH
  COMMENT = 'Pre-submission check failures, one row per failing record'
  AS
  -- R-LNK-01: a route to the firm's own ATS needs a destination new-order event with the same routed order ID.
  SELECT 'R-LNK-01' rule_id, r.trade_date, r.event_id record_id, r.order_id, r.desk, r.source_system,
         OBJECT_CONSTRUCT('routed_order_id', r.routed_order_id, 'destination', r.destination, 'event_ts', r.event_ts) detail
  FROM SRC.ORDER_EVENTS r
  LEFT JOIN SRC.ORDER_EVENTS d ON d.event_type = 'DEST_NEW' AND d.routed_order_id = r.routed_order_id AND d.trade_date = r.trade_date
  WHERE r.event_type = 'ROUTE' AND r.destination = 'NW-ATS' AND d.event_id IS NULL
  UNION ALL
  -- R-SEQ-02: walk each order's events in the system's own step order; flag any event stamped before the NEW event.
  SELECT 'R-SEQ-02', trade_date, event_id, order_id, desk, source_system,
         OBJECT_CONSTRUCT('event_type', event_type, 'event_ts', event_ts, 'new_order_ts', new_ts,
           'ms_before_new', DATEDIFF(millisecond, event_ts, new_ts))
  FROM (SELECT * FROM SRC.ORDER_EVENTS WHERE event_type <> 'DEST_NEW')
    MATCH_RECOGNIZE (
      PARTITION BY order_id ORDER BY step_seq
      MEASURES CLASSIFIER() AS cls, FIRST(n.event_ts) AS new_ts
      ALL ROWS PER MATCH
      PATTERN (^ n (early | ok)+)
      DEFINE n AS event_type = 'NEW', early AS event_ts < FIRST(n.event_ts), ok AS TRUE
    )
  WHERE cls = 'EARLY'
  UNION ALL
  -- R-FLD-03: field domain checks.
  SELECT 'R-FLD-03', trade_date, event_id, order_id, desk, source_system,
         OBJECT_CONSTRUCT('event_type', event_type, 'side', side, 'quantity', quantity, 'symbol', symbol)
  FROM SRC.ORDER_EVENTS
  WHERE event_type IN ('NEW', 'ROUTE', 'EXECUTE') AND (side NOT IN ('B', 'S', 'SS') OR quantity <= 0 OR symbol IS NULL)
  UNION ALL
  -- R-CMP-05: books-to-CAT completeness.
  SELECT 'R-CMP-05', x.trade_date, x.execution_id, x.order_id, x.desk, x.source_system,
         OBJECT_CONSTRUCT('exec_ts', x.exec_ts, 'symbol', x.symbol, 'side', x.side, 'quantity', x.quantity, 'price', x.price)
  FROM SRC.EXECUTIONS x
  LEFT JOIN SRC.ORDER_EVENTS e ON e.event_type = 'EXECUTE' AND e.exec_ref = x.execution_id
  WHERE e.event_id IS NULL;

-- Books-to-CAT reconciliation per trade date and system.
CREATE OR REPLACE DYNAMIC TABLE BOOKS_RECON
  TARGET_LAG = '1 hour' WAREHOUSE = TRV_WH
  COMMENT = 'Executions in the books against EXECUTE events in the reporting feed'
  AS
  SELECT x.trade_date, x.source_system, COUNT(*) books_executions, COUNT(e.event_id) reported_executions,
         COUNT(*) - COUNT(e.event_id) missing_from_cat
  FROM SRC.EXECUTIONS x
  LEFT JOIN SRC.ORDER_EVENTS e ON e.event_type = 'EXECUTE' AND e.exec_ref = x.execution_id
  GROUP BY ALL;

-- Daily volumes, check failures, and regulator rejects per system (feeds the anomaly monitor).
CREATE OR REPLACE DYNAMIC TABLE DAILY_STATS
  TARGET_LAG = '1 hour' WAREHOUSE = TRV_WH
  COMMENT = 'Events, check failures, and regulator rejects per trade date and source system'
  AS
  WITH ev AS (SELECT trade_date, source_system, COUNT(*) events FROM SRC.ORDER_EVENTS WHERE source_system <> 'NW-ATS' GROUP BY ALL),
  rj AS (SELECT e.trade_date, e.source_system, COUNT(*) rejects FROM SRC.CAT_FEEDBACK f JOIN SRC.ORDER_EVENTS e USING (event_id) GROUP BY ALL),
  ck AS (SELECT trade_date, source_system, COUNT(*) failures FROM CHECK_FAILURES GROUP BY ALL)
  SELECT ev.trade_date, ev.source_system, ev.events, COALESCE(rj.rejects, 0) rejects, COALESCE(ck.failures, 0) check_failures
  FROM ev LEFT JOIN rj USING (trade_date, source_system) LEFT JOIN ck USING (trade_date, source_system);

-- 2d. Evidence: run every rule for one trade date and log counts, versions, and query IDs -----------
CREATE OR REPLACE PROCEDURE RUN_CHECKS(TRADE_DATE DATE, TRIGGER_TYPE VARCHAR)
RETURNS VARIANT
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
DECLARE
  run_id VARCHAR DEFAULT 'RUN-' || TO_VARCHAR(:TRADE_DATE, 'YYYYMMDD') || '-' || TO_VARCHAR(CURRENT_TIMESTAMP(), 'YYYYMMDDHH24MISSFF3');
  nulls NUMBER;
  dups NUMBER;
  n_events NUMBER;
BEGIN
  -- Rule-based checks read the CHECK_FAILURES Dynamic Table.
  INSERT INTO RPT.RUN_LOG
  SELECT :run_id, :TRADE_DATE, r.rule_id, r.version,
         CASE r.rule_id
           WHEN 'R-LNK-01' THEN (SELECT COUNT(*) FROM SRC.ORDER_EVENTS WHERE trade_date = :TRADE_DATE AND event_type = 'ROUTE' AND destination = 'NW-ATS')
           WHEN 'R-CMP-05' THEN (SELECT COUNT(*) FROM SRC.EXECUTIONS WHERE trade_date = :TRADE_DATE)
           ELSE (SELECT COUNT(*) FROM SRC.ORDER_EVENTS WHERE trade_date = :TRADE_DATE) END,
         (SELECT COUNT(*) FROM RPT.CHECK_FAILURES f WHERE f.rule_id = r.rule_id AND f.trade_date = :TRADE_DATE),
         LAST_QUERY_ID(), CURRENT_TIMESTAMP(), CURRENT_USER(), :TRIGGER_TYPE
  FROM RPT.RULES r WHERE r.rule_id IN ('R-LNK-01', 'R-SEQ-02', 'R-FLD-03', 'R-CMP-05');
  -- Data metric functions, called on a snapshot of the trade date's feed.
  CREATE OR REPLACE TEMPORARY TABLE RPT.FEED_SNAPSHOT AS SELECT event_id, firm_designated_id FROM SRC.ORDER_EVENTS WHERE trade_date = :TRADE_DATE;
  SELECT COUNT(*) INTO :n_events FROM RPT.FEED_SNAPSHOT;
  LET rs1 RESULTSET := (SELECT SNOWFLAKE.CORE.NULL_COUNT(SELECT firm_designated_id FROM RPT.FEED_SNAPSHOT) v);
  LET c1 CURSOR FOR rs1;
  OPEN c1; FETCH c1 INTO nulls; CLOSE c1;
  INSERT INTO RPT.RUN_LOG SELECT :run_id, :TRADE_DATE, 'R-DQ-06', (SELECT version FROM RPT.RULES WHERE rule_id = 'R-DQ-06'), :n_events, :nulls, LAST_QUERY_ID(), CURRENT_TIMESTAMP(), CURRENT_USER(), :TRIGGER_TYPE;
  LET rs2 RESULTSET := (SELECT SNOWFLAKE.CORE.DUPLICATE_COUNT(SELECT event_id FROM RPT.FEED_SNAPSHOT) v);
  LET c2 CURSOR FOR rs2;
  OPEN c2; FETCH c2 INTO dups; CLOSE c2;
  INSERT INTO RPT.RUN_LOG SELECT :run_id, :TRADE_DATE, 'R-DQ-07', (SELECT version FROM RPT.RULES WHERE rule_id = 'R-DQ-07'), :n_events, :dups, LAST_QUERY_ID(), CURRENT_TIMESTAMP(), CURRENT_USER(), :TRIGGER_TYPE;
  RETURN OBJECT_CONSTRUCT('run_id', :run_id, 'trade_date', :TRADE_DATE);
END;
$$;

-- Backfill a run for every trade date in the data set.
EXECUTE IMMEDIATE $$
DECLARE
  c1 CURSOR FOR SELECT DISTINCT trade_date FROM SRC.ORDER_EVENTS ORDER BY trade_date;
BEGIN
  FOR d IN c1 DO
    LET td DATE := d.trade_date;
    CALL RPT.RUN_CHECKS(:td, 'Backfill');
  END FOR;
  RETURN 'done';
END;
$$;

-- 2e. Anomaly detection on daily volumes and rejects (SNOWFLAKE.ML.ANOMALY_DETECTION) -------------
-- One series per source system and metric. Trained on June to September, run on October.
CREATE OR REPLACE VIEW ANOMALY_TRAIN AS
  SELECT source_system || ' · events' series, trade_date::TIMESTAMP_NTZ ts, events::FLOAT v FROM SRC.DAILY_STATS_HISTORY
  UNION ALL SELECT source_system || ' · rejects', trade_date::TIMESTAMP_NTZ, rejects::FLOAT FROM SRC.DAILY_STATS_HISTORY;
CREATE OR REPLACE VIEW ANOMALY_INPUT AS
  SELECT source_system || ' · events' series, trade_date::TIMESTAMP_NTZ ts, events::FLOAT v FROM DAILY_STATS
  UNION ALL SELECT source_system || ' · rejects', trade_date::TIMESTAMP_NTZ, rejects::FLOAT FROM DAILY_STATS;
CREATE OR REPLACE SNOWFLAKE.ML.ANOMALY_DETECTION VOLUME_MODEL(
  INPUT_DATA => TABLE(ANOMALY_TRAIN), SERIES_COLNAME => 'SERIES', TIMESTAMP_COLNAME => 'TS', TARGET_COLNAME => 'V', LABEL_COLNAME => '');
CALL VOLUME_MODEL!DETECT_ANOMALIES(
  INPUT_DATA => TABLE(ANOMALY_INPUT), SERIES_COLNAME => 'SERIES', TIMESTAMP_COLNAME => 'TS', TARGET_COLNAME => 'V',
  CONFIG_OBJECT => {'prediction_interval': 0.99});
CREATE OR REPLACE TABLE ANOMALY_RESULTS AS SELECT * FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()));

-- 2f. Reporting FAQ for Cortex Search -------------------------------------------------------
-- Written for this example. It paraphrases common reporting concepts; it is not the official
-- technical specification or FAQ text.
CREATE OR REPLACE TABLE SPEC_FAQ (doc_id VARCHAR, error_code VARCHAR, title VARCHAR, body VARCHAR);
INSERT INTO SPEC_FAQ VALUES
('FAQ-01','LNK-01','Route linkage to an industry member','When a firm routes an order to another reporting firm (including an affiliated ATS), the route event and the receiving firm''s new-order event are linked by the routed order ID, the sending and receiving firm identifiers, the symbol, and the trade date. Any mismatch in the routed order ID, including a dropped or added prefix, breaks the link. Repair: correct the routed order ID on whichever side differs from the order management system of record and resubmit the corrected events. Repairs are due within three trading days.'),
('FAQ-02','LNK-01','Internal routes to an affiliated ATS','Routes to the firm''s own ATS are reported on both sides. The ATS reports a new-order event that carries the routed order ID it received. If a routing system changes its ID format, every route from that system can break at once, so check for a recent release before repairing record by record.'),
('FAQ-03','SEQ-02','Event timestamp sequencing','Every event for an order must carry a timestamp at or after the order origination event. Out-of-sequence errors usually come from clock drift on one system, a time zone setting, or a batch that was restamped on reload. Repair: confirm the true times from the system''s own audit log, correct the timestamps, and resubmit. Fix the clock synchronization before the next file.'),
('FAQ-04','SEQ-02','Clock synchronization','Business clocks used for reportable events must be synchronized to a reference time within the firm''s documented tolerance. A drift alert on one system should be logged and the affected events reviewed.'),
('FAQ-05','FLD-03','Field value validation','Each field has an allowed set of values. Side must be buy, sell, or sell short; quantity must be a positive whole number; the symbol must be present. Repair: correct the value in the source record and resubmit only the affected events.'),
('FAQ-06','LTE-04','Late submissions','Files are due by 08:00 Eastern Time on the trading day after the trade date. A late file is accepted but recorded as late. Repair: there is nothing to resubmit; record the cause and the control change that prevents a repeat.'),
('FAQ-07','CA-11','Large trader identifier','Accounts that belong to a large trader must carry the large trader identifier on every account record. Repair: add the identifier from the large trader registration and resubmit the account record.'),
('FAQ-08','CA-12','Address format','Postal codes must be five digits (or five plus four). Leading zeros are often lost when a spreadsheet treats the code as a number. Repair: restore the leading zero and resubmit.'),
('FAQ-09','CA-13','Consistent customer records','A natural person with several accounts must be reported with the same identifying attributes on each account: name, date of birth, address, and a single customer record. Repair: agree on one canonical record, update each account to match it, and resubmit all affected accounts together.'),
('FAQ-10',NULL,'Completeness against the books','Every reportable execution in the books must appear in the reporting feed. Executions booked through manual tickets are a common gap. Reconcile executions to reported events daily, before submission.');

CREATE OR REPLACE CORTEX SEARCH SERVICE SPEC_FAQ_SEARCH
  ON body ATTRIBUTES error_code, title
  WAREHOUSE = TRV_WH TARGET_LAG = '1 day'
  COMMENT = 'Illustrative reporting FAQ written for this example'
  AS SELECT doc_id, error_code, title, body FROM SPEC_FAQ;

-- Done. Quick checks:
SELECT rule_id, COUNT(*) failures FROM RPT.CHECK_FAILURES GROUP BY 1 ORDER BY 1;
SELECT series, COUNT_IF(is_anomaly) anomalies FROM RPT.ANOMALY_RESULTS GROUP BY 1 ORDER BY 1;
