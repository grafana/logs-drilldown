// Types that will automatically get pushed to @grafana/plugin-types
// See https://github.com/grafana/plugin-actions/tree/main/bundle-types for more info on the workflow
// See https://github.com/grafana/plugin-tools/blob/main/packages/plugin-types-bundler for more information on the bundler

// Keep these relative: the types bundler's tsconfig has no baseUrl to resolve src-rooted imports.
export { EmbeddedLogsExplorationProps } from '../EmbeddedLogsExploration/types';
export { OpenInLogsDrilldownButtonProps } from '../OpenInLogsDrilldownButton/types';
