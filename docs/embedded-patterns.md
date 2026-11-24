# Log Patterns

The Grafana extension `grafana-lokiexplore-app/patterns/v1` renders a React Patterns view with search, a volume chart, and expandable pattern rows. It resolves the explicit Loki datasource and calls its native patterns resource. No Drilldown page or Scene root is required by the component.

```tsx
const { component: Patterns } = usePluginComponent<PatternsProps>('grafana-lokiexplore-app/patterns/v1');
return Patterns && <Patterns datasourceUid="my-loki" timeRange={timeRange} query={'{service_name="api"}'} />;
```

The implementation and its tests live in `src/Components/ExposedComponents/Patterns/`; the demo host lives alongside it in `src/Components/ExposedComponents/ExposedPatternsPage.tsx`.

Declare the consumed extension ID in your plugin's `dependencies.extensions.exposedComponents`. Import `usePluginComponent` from `@grafana/runtime`; prop types are exported through `src/Components/ExposedComponents/types.ts` for the existing plugin-types publication workflow.

`query` is a valid LogQL log query. Discovery uses its indexed stream selector, as required by Loki. `timeRange` is required and supplied by the host; the component does not create a default range. `onTimeRangeChange` reports chart zoom requests; update the input to apply them. The host supplies the component's dimensions. The volume chart uses Grafana's native `PanelRenderer` with the existing pattern frames and host-controlled zoom. It creates no Scenes context or URL synchronization. The table uses the Grafana UI `InteractiveTable`, following the normal Patterns table's column definitions, sorting, and native row expansion. Wide containers show sparklines, levels, counts, percentages, and pattern text in columns; containers narrower than 830px stack these details. Expanding a row loads sample logs through the native Loki datasource and renders Grafana's logs panel. The `getPatternLogs` service in `src/services/patterns.ts` loads samples and retries with the indexed selector when query filters return none; the component shows a warning. Both the service and the normal Patterns Scene use its shared `buildPatternLogsQuery` helper.

The local test host is `/a/grafana-lokiexplore-app/patterns`, with optional `datasourceUid` and `query` parameters. It uses the default Loki datasource rather than an unchecked saved preference. Restart Grafana after installing the extension declarations.

This version deliberately excludes Fields, Labels, and the general MCP/adapter framework. The earlier implementations remain in Git stashes. The normal Patterns tab and this component share the exported `getPatterns` fetch-and-processing function in `src/services/patterns.ts`. The embeddable calls `getEmbeddedPatterns` from the same service to resolve its datasource and prepare the resulting DataFrames as `PatternFrame` values. Both views use the service's `overrideToFixedColor` palette helper.

The shared data path was also checked manually with live Loki data.
