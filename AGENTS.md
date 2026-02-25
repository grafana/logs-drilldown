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

- **Frontend security** — Follow workspace rules for HTML sanitization (DOMPurify), URLs (`textUtil.sanitizeUrl`), and avoiding unsafe DOM APIs.
- **Variables** — `VAR_LABELS_EXPR` (`${filters}`) is the label/stream selector used across Logs, Patterns, Labels, and Fields tabs.
- **Resource queries** — Patterns, detected_labels, and detected_fields use `getResource` with a stream selector; they do not use full LogQL pipelines.
