import { urlUtil } from '@grafana/data';

import pluginJson from 'plugin.json';

// jest tests struggle with import order when importing from the plugin.json, moving methods that use the plugin_id to its own file makes it simpler to import when mocking
export const PLUGIN_ID = pluginJson.id;
export const PLUGIN_BASE_URL = `/a/${PLUGIN_ID}`;
export const PLUGIN_CONFIGURATION_PAGE_ID = 'configuration';

// Prefixes the route with the base URL of the plugin
export function prefixRoute(route: string, baseUrl = PLUGIN_BASE_URL): string {
  return `${baseUrl}/${route}`;
}

/** Grafana plugin admin URLs use a `page` query param, not a `/page/:id` path segment. */
export function getPluginConfigPageLocation(configPageId = PLUGIN_CONFIGURATION_PAGE_ID) {
  return {
    pathname: `/plugins/${PLUGIN_ID}`,
    search: urlUtil.renderUrl('', { page: configPageId }),
  };
}
