# e2e static-data Loki setup

This directory houses everything required to run the Playwright e2e suite
against a Loki instance pre-loaded with a deterministic, time-bounded
dataset. The pattern mirrors `metrics-drilldown/e2e`, where Prometheus is
provisioned with a static TSDB snapshot and tests use fixed `from`/`to`
search params instead of `now-*`.

```
tests/static-loki/
  docker/
    Dockerfile.loki-static-data        # Builds a Loki image pre-loaded with the snapshot
    docker-compose.snapshot.yaml       # Helper compose file used only when generating the snapshot
  provisioning/
    loki/
      data.zip                         # Committed snapshot of /tmp/loki produced by the generator
  scripts/
    generate-loki-snapshot.sh          # Regenerates data.zip from scratch (pnpm run generate:loki-snapshot)
```

## How it fits together at test time

`docker-compose.dev.yaml` uses `Dockerfile.loki-static-data` to build the
`loki` service. At image build time `data.zip` is unzipped into `/tmp/loki`,
so when the container starts it already has all chunks, indices, and rules
on disk. The Playwright suite runs Grafana with the `gdev-loki` datasource
provisioned (`url: http://host.docker.internal:3100`, header
`X-Scope-OrgID: 1`) and queries the static window using fixed `from`/`to`
search params from `tests/config/constants.ts`. There is no live generator
in the e2e environment.

## When to regenerate the snapshot

Run `pnpm run generate:loki-snapshot` whenever you:

* Add or rename services / labels in the generator (e.g. `generator/generator.go`)
* Change Loki configuration in a way that affects index or chunk layout
* Need to extend the time window or add new patterns covered by the suite

The script:

1. Spins up a temporary Loki container (using the same configs as
   `docker-compose.dev.yaml`).
2. Runs the generator with `-static-start=2025-05-26T11:00:00Z
   -static-duration=65m -static-step=5s -seed=42 -tenant-id=1`. The
   generator emits a bounded amount of data per service inside that window,
   then exits.
3. Calls Loki's `/flush` endpoint to force ingester chunks to filesystem
   storage.
4. Copies `/tmp/loki` out of the container, zips it, and writes the result
   to `tests/static-loki/provisioning/loki/data.zip`.

After the script finishes you can inspect the diff with `git status`/`git
diff` and commit the new `data.zip`.

## Why the timestamps are fixed

Loki's `/loki/api/v1/query_range` returns logs whose timestamp falls inside
the requested `[from, to]` range. The static dataset uses
`2025-05-26T11:00:00Z` to `2025-05-26T12:05:00Z`, and Playwright tests
should query the same window via `tests/config/constants.ts`
(`DEFAULT_STATIC_URL_SEARCH_PARAMS`). Using `now-*&to=now` against the
static dataset would return nothing because the data is anchored to a fixed
moment in 2025 rather than the wall clock at test time.

The default Loki retention (`30d`) on tenant `1` is overridden in
`config/loki-overrides.yaml` to keep the snapshot queryable indefinitely.

## Live local development

`docker-compose.dev.yaml` is reserved for the static-data e2e flow. For
live local development, keep using:

* `pnpm run server:localLoki` (live Loki + live generator, see
  `docker-compose-local-loki.dev.yaml`)
* `pnpm run start:all` (Loki + Tempo + Mimir + generator, see
  `docker-compose-local-all.yaml`)

Those flows still use wall-clock timestamps and the live generator.

## Writing tests against the static window

Use the helpers/constants in `tests/config/constants.ts`:

* `STATIC_FROM` / `STATIC_TO` - ISO-8601 strings covering the snapshot.
* `DEFAULT_STATIC_URL_SEARCH_PARAMS` - prebuilt `URLSearchParams` with
  `var-ds=gdev-loki`, `from`, `to`, and `timezone=utc`.

The fixture helpers in `tests/fixtures/explore.ts`
(`gotoServicesBreakdownOldUrl`, `gotoLogsPanel`) default to the static
window. New navigations should pass explicit `from`/`to` query params using
`STATIC_FROM`/`STATIC_TO` rather than `now-*&to=now`.

### Known caveats

* The "mega menu click should reset url params" test in
  `tests/appNavigation.spec.ts` exercises the app's reset-to-default
  behavior, which reverts `from`/`to` to the hardcoded
  `Components/Pages.tsx#DEFAULT_TIME_RANGE` (`now-15m`/`now`). Against the
  static dataset this window returns no rows, so any data-dependent
  assertions in that flow may need a follow-up navigation to
  `STATIC_FROM`/`STATIC_TO`.
