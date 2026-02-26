# Agent Guidelines for Logs Drilldown

Instructions for AI agents working on the Grafana Logs Drilldown plugin.

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

### Grafana Scenes

Logs Drilldown uses [@grafana/scenes](https://grafana.com/developers/scenes/) for app structure, routing, and interactive UI. When working on scenes-related code, follow the [Grafana Scenes documentation](https://grafana.com/developers/scenes/) and [demos](https://github.com/grafana/scenes/tree/main/packages/scenes-app/src/demos)

- **SceneApp and useSceneApp** — Use `SceneApp` as the root object for routing and Grafana integration. Memoize and cache scene creation with `useSceneApp` so URL syncing works and state is preserved when navigating away and back.

- **Scene objects** — Custom scene objects extend `SceneObjectBase<SceneObjectState>`. Implement state-modifying logic in the scene object class (not in the renderer) to keep model complexity separate from the component. Use `model.useState()` to subscribe to state changes and `model.setState()` to modify state.

- **Object tree** — Do not reuse the same scene object instance in multiple scenes or locations. Use `SceneObjectRef` to wrap shared references, or clone the source object for separate instances.

- **Data and time range** — Use `$data` (e.g. `SceneQueryRunner`) and `$timeRange` (e.g. `SceneTimeRange`) on scene objects. These propagate to descendants in the object tree.

- **Layout** — Use `SceneFlexLayout`, `SceneFlexItem`, `EmbeddedScene`, and `SceneAppPage` for structure. For app pages, use `SceneAppPage` for drill-downs, tabs, breadcrumbs, and routing.
