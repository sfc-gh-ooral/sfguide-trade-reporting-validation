# Self-review

Taken from the self-review in the catalog pull request ([sfc-gh-ooral/snow-packs#39](https://github.com/sfc-gh-ooral/snow-packs/pull/39)), November 2026.

## Build standard: Before you call it done
- Pass: fresh clone in Sample mode; setup → Live → cleanup in the pack role (re-run this round for the anomaly change).
- Pass: grep of files and full git history for secrets, account identifiers, user names.
- Pass: Pages URL and /try/ signed out at 390 px and 1440 px. Skipped: dark mode not re-checked this round.
- Pass: every brief story beat appears in a screenshot.

## CONTRIBUTING Musts
- Pass: business problem first; one industry (Capital Markets) and function (Compliance).
- Pass: public `sfguide-trade-reporting-validation`, Apache 2.0 LICENSE, Pages from /docs with .nojekyll.
- Pass: headline and scenario first; screenshots of the running app, each with caption naming the capability and alt text.
- Pass: capabilities named per step, and only ones run live (Anomaly Detection now included).
- Pass: synthetic-data / not-advice disclaimer; links to repo and Snowflake docs.
- Pass: no Snowflake logo files; no internal sales language.
- Pass: end-user workflow app; no-account Sample mode with `setup: local` and `demoUrl`; "Sample AI response" labels; Live mode on Snowflake.
- Pass: deterministic synthetic data; dedicated database, XSMALL warehouse (AUTO_SUSPEND 60), least-privilege role; cleanup removes all of it.
- Pass: no credentials, account IDs, internal hostnames or user names in code, screenshots or history. Note: sample data and one screenshot carry query IDs from a demo-account run (see optional items below).
- Pass: no customer names, deals, internal programs or roadmap features; GA features only.
- Pass: README prerequisites, run steps and object table, cost and time, known limitations, Customize with Cortex Code, `Owner: Oz Oral · Last reviewed: November 2026`, license and as-is disclaimer.
- Pass: outcomes described as possibilities; synthetic results qualified.


## Polish pass, November 20, 2026

- Fresh clone, `npm ci`, `npm run dev`: pass (home page returns 200).
- Dark mode: renders with the dark theme, no console errors.
- Optional items from the review, done: hover tooltips on the KPI sparklines (date and value) and the order timeline, plus value tooltips on the rule, repair and CAIS match meters (the Recharts charts already had tooltips); the sample data and `07-evidence.png` now carry synthetic query IDs (`scripts/lib/synthetic-query-ids.mjs`, applied by `scripts/capture-sample.mjs` on every capture); repo topics added and Template repository turned on.
- `npm run lint` and `tsc --noEmit`: pass.
