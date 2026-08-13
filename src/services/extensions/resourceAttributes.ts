import {
  type IconName,
  type PluginExtensionAddedLinkConfig,
  PluginExtensionPoints,
  type PluginExtensionResourceAttributesContext,
} from '@grafana/data';

import { PLUGIN_BASE_URL } from 'services/plugin';
import { SERVICE_NAME, SERVICE_UI_LABEL, VAR_LABELS } from 'services/variables';

const HOST_OS_PROCESS_TELEMETRY_ATTRIBUTES = [
  'host.arch',
  'os.type',
  'os.description',
  'os.name',
  'os.version',
  'os.build_id',
  'process.pid',
  'process.parent_pid',
  'process.executable.name',
  'process.executable.path',
  'process.command',
  'process.command_line',
  'process.command_args',
  'process.owner',
  'process.runtime.name',
  'process.runtime.version',
  'process.runtime.description',
  'process.working_directory',
  'telemetry.sdk.name',
  'telemetry.sdk.language',
  'telemetry.sdk.version',
  'telemetry.distro.name',
  'telemetry.distro.version',
] as const;

/** withService — filter service.name plus this attribute */
const withService = <T extends string>(attributeName: T) => ({
  attributeName,
  filters: ['service.name', attributeName] as const,
});

/** asEntity — show the link on this row, filter the parent entity */
const asEntity = <T extends string, E extends string>(attributeName: T, entity: E) => ({
  attributeName,
  filters: [entity] as const,
});

/** LOG_RESOURCE_ATTRIBUTE_LINKS — rows with no helper filter only that attribute */
export const LOG_RESOURCE_ATTRIBUTE_LINKS = [
  { attributeName: 'service.name' },
  { attributeName: 'service.namespace' },
  withService('service.version'),
  withService('service.instance.id'),
  withService('deployment.environment'),
  withService('deployment.environment.name'),
  withService('k8s.namespace.name'),
  { attributeName: 'k8s.pod.name' },
  { attributeName: 'k8s.deployment.name' },
  { attributeName: 'k8s.node.name' },
  asEntity('k8s.container.name', 'k8s.deployment.name'),
  asEntity('container.name', 'k8s.deployment.name'),
  asEntity('container.id', 'k8s.pod.name'),
  asEntity('k8s.pod.uid', 'k8s.pod.name'),
  asEntity('k8s.pod.ip', 'k8s.pod.name'),
  asEntity('k8s.pod.start_time', 'k8s.pod.name'),
  ...HOST_OS_PROCESS_TELEMETRY_ATTRIBUTES.map((attributeName) => ({ attributeName })),
] as const;

/** Closed set of OTel resource attribute keys we register as TraceView rows. */
export type LogResourceAttributeName = (typeof LOG_RESOURCE_ATTRIBUTE_LINKS)[number]['attributeName'];
export type LogResourceAttributeLinkConfig = (typeof LOG_RESOURCE_ATTRIBUTE_LINKS)[number];

/** Visible label in TraceView (menu uses description, then title). */
export const RESOURCE_ATTRIBUTE_LINK_LABEL = 'Logs Drilldown';
export const RESOURCE_ATTRIBUTE_LINK_ICON: IconName = 'gf-logs';

const EXPLORATIONS_ROUTE = `${PLUGIN_BASE_URL}/explore`;

const linkCopy = {
  title: RESOURCE_ATTRIBUTE_LINK_LABEL,
  description: RESOURCE_ATTRIBUTE_LINK_LABEL,
  icon: RESOURCE_ATTRIBUTE_LINK_ICON,
};

/** Loki indexes OTel attributes with underscores (service.name → service_name). */
export function toLokiLabel(attributeName: string): string {
  return attributeName.replace(/\./g, '_');
}

function attrValue(
  attributes: Record<string, string[]> | undefined,
  name: LogResourceAttributeName
): string | undefined {
  return attributes?.[name]?.[0]?.trim() || undefined;
}

/** filterNames — Loki label sources; defaults to the row attribute when omitted or empty */
function filterNames(config: LogResourceAttributeLinkConfig): LogResourceAttributeName[] {
  if ('filters' in config && config.filters.length > 0) {
    return [...config.filters];
  }
  return [config.attributeName];
}

/** makeLogResourceAttributeLink — TraceView link (`category === attribute.key`) that opens Logs Drilldown */
export function makeLogResourceAttributeLink(
  config: LogResourceAttributeLinkConfig
): PluginExtensionAddedLinkConfig<PluginExtensionResourceAttributesContext> {
  const filters = filterNames(config);
  const required = [...new Set([config.attributeName, ...filters])];

  return {
    targets: [PluginExtensionPoints.TraceViewResourceAttributes],
    ...linkCopy,
    // TraceView matches a row via category === key today or group.name
    category: config.attributeName,
    group: { name: config.attributeName },
    path: EXPLORATIONS_ROUTE,
    configure: (context) => {
      const values: Record<string, string> = {};

      for (const name of required) {
        const value = attrValue(context?.attributes, name);
        if (!value) {
          return undefined;
        }
        values[name] = value;
      }

      // TraceView contexts use Tempo; omit var-ds so Logs Drilldown uses the user's Loki default.
      if (!context?.datasource?.uid || context.datasource.type !== 'tempo') {
        return undefined;
      }

      const params = new URLSearchParams();
      const primaryAttr = filters[0];
      const primaryValue = primaryAttr ? values[primaryAttr] : undefined;

      for (const name of filters) {
        params.append(`var-${VAR_LABELS}`, `${toLokiLabel(name)}|=|${values[name]}`);
      }

      if (context.timeRange) {
        params.set('from', String(context.timeRange.from));
        params.set('to', String(context.timeRange.to));
      }

      // Deep-link into the primary label's logs tab when we have a filter value.
      let path = EXPLORATIONS_ROUTE;
      if (primaryAttr && primaryValue) {
        const lokiLabel = toLokiLabel(primaryAttr);
        const pathLabel = lokiLabel === SERVICE_NAME ? SERVICE_UI_LABEL : lokiLabel;
        path = `${EXPLORATIONS_ROUTE}/${pathLabel}/${encodeURIComponent(primaryValue)}/logs`;
      }

      return {
        ...linkCopy,
        path: `${path}?${params.toString()}`,
      };
    },
  };
}
