# Agent Guidelines for Logs Drilldown

Instructions for AI agents working on the Grafana Logs Drilldown plugin.

## Related documentation

| File                                 | What it's for                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **`AGENTS.md`** (this file)          | **Entry point.** Loki & LogQL workflow, expected vs bug, Scenes patterns, security. Points to every other doc below. |
| **`CONTRIBUTING.md`**                | **Human contributors.** Dev setup, issues vs PRs, i18n, PR checklist, link to GenAI policy.                          |
| **`docs/genai.md`**                  | **AI-assisted contributions.** Disclosure, acceptable use, Logs Drilldown-specific pitfalls.                         |
| **`.config/AGENTS/instructions.md`** | **Plugin tooling only** — webpack, `plugin.json`, E2E, rules about `.config`.                                        |
| **`docs/sources/`**                  | **Shipped user docs** — patterns, labels, fields, troubleshooting.                                                   |

## Before Investigating Issues or Bugs

**Read relevant documentation before making code changes or proposing fixes.**

### Loki API Documentation

Start with the [Grafana Loki documentation](https://grafana.com/docs/loki/latest/). When working on Loki-related features (patterns, queries, labels, fields), consult in particular:

- **[Loki HTTP API reference](https://grafana.com/docs/loki/latest/reference/loki-http-api/)** — API specs for all Loki endpoints
- **[Patterns API](https://grafana.com/docs/loki/latest/reference/loki-http-api/#patterns-detection)** — Accepts **stream selectors only** (equivalent to **indexed labels only**). Non-indexed labels and line filters are not applied. This is expected behavior, not a bug.
- **[Log queries](https://grafana.com/docs/loki/latest/query/log_queries)** — Distinguishes stream selectors from log pipelines (parsers, line filters, etc.).
- **[Labels](https://grafana.com/docs/loki/latest/configure/#labels)** — Indexed vs. non-indexed labels, cardinality.

### Local Project Documentation

- **`docs/sources/`** — Logs Drilldown user-facing docs (patterns, labels, fields, troubleshooting).
- **[Grafana Logs Drilldown documentation](https://grafana.com/docs/grafana/latest/visualizations/simplified-exploration/logs/)** — User-facing docs for Logs Drilldown.

### Determine Expected Behavior First

Before proposing a fix, verify whether the reported behavior is:

- **Expected** — e.g., the Loki patterns API only supports stream selectors; "pod filter not applied to Patterns" may be expected if `pod` is not an indexed label.
- **A bug** — e.g., if `pod` is indexed and the filter should apply but doesn't.

## Project Conventions

Refer to `.config/AGENTS/instructions.md` for Grafana plugin–specific rules. Never modify anything inside the `.config` folder; It is managed by Grafana plugin tools.

- **Frontend security** — Follow workspace rules for HTML sanitization (DOMPurify), URLs (`textUtil.sanitizeUrl`), and avoiding unsafe DOM APIs.

### Code comments

- **One line max** — Keep code comments to a single line. State the constraint or workaround the code can't express by itself; move longer explanations to the commit message or PR description.

### TypeScript and DOM events

- **No `unknown` double-casts for events** — Do not recover legacy fields with `(e as unknown as { srcElement?: … }).srcElement`. Prefer `event.currentTarget`, typed handlers, `instanceof` checks, or a small well-named helper with a real type guard.
- **No non-null assertions (`!`) to silence indexing** — Do not use `arr[arr.length - 1]!.value` or similar. After checking length, bind the last element to a variable (`const last = options[options.length - 1]`) and narrow with an explicit guard (`if (last == null) return;`) so TypeScript and readers see the same contract.
- **Avoid redundant or contradictory guards** — Do not repeat the same emptiness check or stack unrelated conditions in one `if` (e.g. `options.length === 0` twice, or mixing length checks with a redundant `=== undefined` on the same path). Prefer one early return and a single, clear invariant for “last option exists.”

### Grafana Scenes

Logs Drilldown uses [@grafana/scenes](https://grafana.com/developers/scenes/) for app structure, routing, and interactive UI. When working on scenes-related code, follow the [Grafana Scenes documentation](https://grafana.com/developers/scenes/) and [demos](https://github.com/grafana/scenes/tree/main/packages/scenes-app/src/demos)

- **SceneApp and useSceneApp** — Use `SceneApp` as the root object for routing and Grafana integration. Memoize and cache scene creation with `useSceneApp` so URL syncing works and state is preserved when navigating away and back.

- **Scene objects** — Custom scene objects extend `SceneObjectBase<SceneObjectState>`. Implement state-modifying logic in the scene object class (not in the renderer) to keep model complexity separate from the component. Use `model.useState()` to subscribe to state changes and `model.setState()` to modify state.

- **Object tree** — Do not reuse the same scene object instance in multiple scenes or locations. Use `SceneObjectRef` to wrap shared references, or clone the source object for separate instances.

- **Data and time range** — Use `$data` (e.g. `SceneQueryRunner`) and `$timeRange` (e.g. `SceneTimeRange`) on scene objects. These propagate to descendants in the object tree.

- **Layout** — Use `SceneFlexLayout`, `SceneFlexItem`, `EmbeddedScene`, and `SceneAppPage` for structure. For app pages, use `SceneAppPage` for drill-downs, tabs, breadcrumbs, and routing.

### Playwright E2E

- **Centralize selectors** — Define stable `data-testid` values in **`src/services/testIds.ts`** (nested object grouped by feature area). Do not scatter raw `'data-testid …'` strings across components or tests.
- **Wire in components** — For any **new** interactive control that E2E tests need to target (primary buttons, tabs, comboboxes, filters), add `data-testid={testIds…}` on the focusable control or its root (follow existing patterns in the repo; Grafana `@grafana/ui` components usually accept `data-testid` on inputs and comboboxes).
- **Write tests against `testIds`** — In Playwright specs, use `page.getByTestId(testIds.some.path)` (or the project’s equivalent) instead of brittle locators such as concatenated visible text (`FieldAll`), placeholder-only queries, or `getByText` for strings that depend on layout or i18n.
- **When to add IDs** — Add or extend `testIds` when you introduce new UI that should be covered by E2E, or when a test would otherwise rely on implementation details of `@grafana/ui` (e.g. tooltip vs dialog, label + value split across nodes).
- **Naming** — Keep the same string style as existing entries (e.g. `'data-testid search-fields'`). Prefer descriptive, stable slugs over feature-coupled names that will churn on every copy change.

### Verify runtime/behavioral claims, don't trust static reading alone

Scenes wiring (activation lifecycles, subscriptions, async query runners) is easy to reason about incorrectly from source alone — code that _looks_ like it should re-run a query, reset some state, or leak a subscription often doesn't, because a sibling scene object gets torn down first, or an assertion collides with an unrelated feature's coincidentally-identical query shape. **Before asserting a behavioral claim as fact** (in a PR review, a bug investigation, or your own fix) **that a real dev stack could confirm or refute, write a small Playwright test and run it**, rather than relying solely on tracing subscriptions through the diff.

- **Run a single spec against a running Grafana** (`docker ps` should show `grafana-logsapp`/`logs-drilldown-*` containers, or an equivalent local dev stack):

  ```bash
  pnpm exec playwright test tests/path/to.spec.ts --project=chromium --reporter=list --retries=0
  ```

  The `auth` project dependency (login + storage state) runs automatically; no separate setup step needed.

- **Local dev stack vs. the E2E fixture data** — A general local dev stack (started via `docker compose`, with a live log **generator** container continuously producing data) is _not_ the same as the static, pre-baked Loki snapshot (`tests/static-loki/`) that CI and the full Playwright suite are built against. Tests that use the fixed `STATIC_FROM`/`STATIC_TO` window (`tests/config/constants.ts`) will show **zero data** against a live-generator stack. To manually verify a test locally, temporarily point navigation at a live window instead (e.g. `gotoServicesBreakdownOldUrl(service, 'now-1h', 'now')`), confirm it behaves as expected, then **revert to `STATIC_FROM`/`STATIC_TO`** (or the helper's defaults) before committing — the live window will find no data at all in CI.

- **Gotchas worth knowing up front** (each cost real debugging time to rediscover):
  - `ExplorePage.blockAllQueriesExcept`'s `requests`/`responses` capture arrays populate **asynchronously**, after `route.fetch()` resolves — poll (`expect.poll(...)`) rather than reading the array immediately after the action that should have triggered a request.
  - Register `blockAllQueriesExcept` **after** the initial page navigation/bootstrap has completed, not before — blocking too early can starve a bootstrap-critical query and hang the app on "Loading...".
  - Panel header actions can be conditionally rendered (e.g. a collapsed panel hides its header controls entirely) — assert the control is visible before interacting with it, and expand/toggle whatever's needed first.
  - A control's accessible name can come from a wrapping element (e.g. `InlineField`'s visible label via `aria-labelledby`) rather than its own `aria-label` prop — verify the real accessible name with a snapshot or `page.getByRole(...).count()`, don't assume it matches what the JSX sets.
  - Different features can coincidentally reuse the same `legendFormat`/`refId` convention (e.g. a per-field breakdown panel and an unrelated grouped-by panel both legend-formatting as `{{fieldName}}}`). When asserting on a specific panel's query, disambiguate by the query's actual `expr` shape, not just `legendFormat`/`refId`.

## Usage

Start with the **Related documentation** table above, then open the doc that matches your task.

**Human contributors:** follow [CONTRIBUTING.md](CONTRIBUTING.md) for how to file issues, open pull requests, run local checks, and use AI tools responsibly. The full GenAI policy is in [docs/genai.md](docs/genai.md).
