# Regulatory Trade Reporting Validation (CAT and CAIS)

Help broker-dealer reporting teams catch errors before submission, reconcile against the books, and
work regulator feedback faster, for the Consolidated Audit Trail (CAT) and the Customer and Account
Information System (CAIS). A Snowflake example on synthetic data.

- **Guide:** https://sfc-gh-ooral.github.io/sfguide-trade-reporting-validation/
- **Try it (no account):** https://sfc-gh-ooral.github.io/sfguide-trade-reporting-validation/try/

> Synthetic data only (fictional broker-dealer "Northwind Securities"). Schemas, rules, and error
> codes are simplified and illustrative; they are **not** the official CAT or CAIS specifications.
> Not regulatory, legal, or compliance advice. AI output is a suggestion that a person reviews.

## What it does

| Screen | For | What you see |
| --- | --- | --- |
| Submission health | Reporting manager | Events reported, check failures, regulator rejects, share caught before submission, repair backlog, and a countdown to the oldest open repair deadline |
| Pre-submission checks | Reporting analyst | Rule library results per trade date, drill-down to failing records, books-to-CAT reconciliation |
| Order timeline | Reporting analyst | One order's lifecycle as a swimlane graph (firm, destination ATS, books), with route linkage IDs side by side |
| Reject workbench | Reporting analyst | Regulator rejects clustered by error code, system, and desk; an AI explanation and suggested repair grounded in FAQ excerpts; assign and mark-repaired in bulk |
| CAIS customers | Reporting analyst | A customer across accounts with conflicting fields highlighted; AI_SIMILARITY matching; a proposed canonical record a person approves |
| Anomaly monitor | Manager | Daily events and rejects per source system against a forecast band, with anomalies flagged |
| Evidence | Compliance and audit | Every check run with rule versions, counts, and query IDs; every human decision, who made it, and whether AI assisted |

**Story on this synthetic data set:** the health page shows a reject spike on the October 29 file;
the workbench clusters it to one system and desk (ALGO-X, Program Trading) breaking route linkage;
the order timeline shows the routed order ID lost its `PT-` prefix at the ATS; the AI explains the
error code and suggests a repair; the analyst assigns and repairs the cluster; the CAIS conflict for
one customer is resolved with an approved canonical record; and each decision lands in the evidence
log. The planted stories are listed in [data/README.md](data/README.md).

## Snowflake capabilities used (all run in Live mode)

| Capability | Where |
| --- | --- |
| Dynamic Tables | `CHECK_FAILURES` (rule checks), `BOOKS_RECON` (books-to-CAT), `DAILY_STATS` (volumes, failures, rejects) |
| Window functions | R-SEQ-02 sequence check (`MAX ... OVER`, `LAG`) inside the Dynamic Table |
| Data metric functions | `SNOWFLAKE.CORE.NULL_COUNT` and `DUPLICATE_COUNT` scheduled on the feed and called per trade date by `RUN_CHECKS` (rules R-DQ-06, R-DQ-07) |
| `SNOWFLAKE.ML.ANOMALY_DETECTION` | `VOLUME_MODEL`, trained on June to September daily counts and run on October |
| Cortex Search | `SPEC_FAQ_SEARCH` over FAQ excerpts written for this example |
| `AI_COMPLETE` | Reject explanation and suggested repair (default model `claude-sonnet-4-5`) |
| `AI_SIMILARITY` | Matching CAIS customer records across accounts |
| Git repository + `COPY FILES` | `setup.sql` loads the synthetic CSVs from this public repository |

`MATCH_RECOGNIZE` is a natural fit for order lifecycle checks, but Snowflake
rejects `MATCH_RECOGNIZE` in a Dynamic Table definition ("Object ref values of type
MATCH_RECOGNIZE_CLAUSE not supported"), so the sequence check uses window functions instead. A
Cortex Agent ("why did yesterday's rejects spike?") is not included.

## Prerequisites

- **Sample mode:** Node.js 20.19 or later. Nothing else.
- **Live mode:** a Snowflake account on **Enterprise Edition or higher** (data metric functions), with
  Cortex AI functions and Cortex Search available in your region or
  [cross-region inference](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cross-region-inference)
  enabled, and a user that can use ACCOUNTADMIN once to create a role, warehouse, database, and API
  integration.

## Quick start: Sample mode (no account)

```bash
git clone https://github.com/sfc-gh-ooral/sfguide-trade-reporting-validation.git
cd sfguide-trade-reporting-validation
npm install
npm run dev        # http://localhost:3000
```

Sample mode runs on `lib/sample/data.json`, captured from a live run. AI answers in Sample mode are the
ones Cortex returned in that run and are labeled **Sample AI response**; they play back after a 4 to 8
second delay with the same progress steps as Live mode. Repairs and approvals are kept in memory for
the session.

## Live mode: deploy to your account

1. Open `sql/setup.sql` in a Snowsight SQL worksheet and **Run All** as a user with ACCOUNTADMIN.
   It takes about 3 to 3.5 minutes on the XSMALL warehouse it creates.
2. Create a key pair and register the public key on your user (commands in `.env.example`).
3. `cp .env.example .env.local` and fill in your account identifier, user, and key path.
4. `npm run dev`, then switch the header to **Live**. Every screen now reads Snowflake as
   `TRV_DEMO_ROLE`, and each card shows the measured round trip.

If a Live call fails, the screen shows the error. It never falls back to sample data silently.

To refresh the sample from your own live run: `node scripts/capture-sample.mjs http://localhost:3000`.

### Objects created

| Object | Name | Notes |
| --- | --- | --- |
| Role | `TRV_DEMO_ROLE` | Owns every object below; the app connects with it. Granted `SNOWFLAKE.CORTEX_USER`, `SNOWFLAKE.DATA_METRIC_USER`, and `EXECUTE DATA METRIC FUNCTION` |
| Warehouse | `TRV_WH` | XSMALL, `AUTO_SUSPEND = 60`, initially suspended |
| Database | `TRADE_REPORTING_DEMO` | Schemas `SRC` (books, feed, submissions, feedback) and `RPT` (pipeline, workflow, evidence) |
| Dynamic Tables | `RPT.CHECK_FAILURES`, `RPT.BOOKS_RECON`, `RPT.DAILY_STATS` | `TARGET_LAG = '1 hour'` |
| Procedure | `RPT.RUN_CHECKS` | Logs one run per trade date to `RPT.RUN_LOG` |
| Anomaly model | `RPT.VOLUME_MODEL` | Results in `RPT.ANOMALY_RESULTS` |
| Cortex Search service | `RPT.SPEC_FAQ_SEARCH` | `TARGET_LAG = '1 day'` |
| Git repository, stage | `SRC.TRV_REPO`, `SRC.TRV_DATA` | Public repository, read only |
| API integration | `TRV_GIT_API` | `git_https_api`, limited to `https://github.com/sfc-gh-ooral/` |

`setup.sql` changes nothing that already exists.

### Expected cost and time

Measured in one run on an AWS US account (November 2026):

| Step | Time |
| --- | --- |
| `setup.sql`, top to bottom | 180 to 197 seconds |
| Screen loads in Live mode | 0.1 to 4 seconds per screen (first call opens the connection) |
| Reject explanation (Cortex Search + `AI_COMPLETE`) | 6.2 to 8.3 seconds per cluster |
| Customer matching (`AI_SIMILARITY`) | about 0.8 seconds |
| Run checks again (Dynamic Table refresh + `RUN_CHECKS`) | about 5 seconds |

Warehouse time for setup is about 3.5 minutes of XSMALL, which at XSMALL's rate of 1 credit per hour
is roughly 0.06 credits (an estimate from measured time, not a billing figure). Cortex AI functions,
Cortex Search serving, Dynamic Table refreshes, and data metric functions add small charges that
depend on your region and pricing. Run `sql/cleanup.sql` when you're done: the Dynamic Tables refresh
hourly and the search service refreshes daily while they exist.

### Clean up

Run `sql/cleanup.sql`. It drops the database (and everything in it) and warehouse as `TRV_DEMO_ROLE`,
then the API integration and role as ACCOUNTADMIN, and ends with `SHOW` commands that should return no
rows. Delete `.env.local` and your key if you created one only for this example.

## Known limitations

- Schemas, rules, error codes, deadlines, and regulator feedback are simplified and illustrative.
  The regulator feedback is generated with the data, not received from a regulator.
- The data set is frozen at a business clock (October 30, 2026, 16:00 ET) so deadlines read the same
  every time. The repair deadline rule (third trading day, 08:00 ET) is illustrative and ignores holidays.
- Repairs are recorded in the app; nothing is resubmitted anywhere.
- Customer matching compares only records that share the tax ID's last four digits (a simple blocking
  key). A production matcher needs better blocking and review of low-confidence pairs.
- The FAQ searched by Cortex Search was written for this example; it is not the official text.
- The app connects with one role. There is no per-user row access or masking in this example.
- MATCH_RECOGNIZE isn't supported inside Dynamic Tables, so the sequence check uses window functions.

## Customize with Cortex Code

- "Map my OMS event tables to `SRC.ORDER_EVENTS` and list the fields I can't map."
- "Add a rule to the library for late reporting by event type, with tests, and include it in `RUN_CHECKS`."
- "Tune `VOLUME_MODEL` for my daily volumes and explain the false-positive trade-off of the prediction interval."

## Project layout

```
app/            Next.js screens and the /api/data route
components/     Shell, Sample/Live switch, staged AI progress, shared UI
lib/            Data interface, live (Snowflake) and sample sources, shared rules
data/           Synthetic CSVs and the rule library (see data/README.md)
scripts/        Data generator, sample capture, hosted example build, screenshots
sql/            setup.sql and cleanup.sql
docs/           GitHub Pages guide and the hosted example in docs/try/
```

## License and disclaimer

Apache 2.0 (see [LICENSE](LICENSE) and [LEGAL.md](LEGAL.md)). This is an example provided as is. It is
not an official Snowflake product and is not supported by Snowflake Support.

Owner: Oz Oral · Last reviewed: November 2026
