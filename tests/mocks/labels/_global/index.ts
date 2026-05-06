/**
 * Plain-data fixtures used by the service-selection scene and the embed
 * bootstrap (volume aggregated across services, primary-label `ts-*` queries
 * when no per-service filter is in the expression, the limits/labels/series
 * endpoints, etc.).
 *
 * Everything exported from here is raw data — no functions, no dispatchers.
 * Scenarios in `tests/mocks/scenarios/` import what they need and register
 * routes inline.
 */
import dsQueryData from './dsQuery.json';
import volumeData from './volume.json';

import { volumeStats } from './volumeStats';

export type CapturedResponse = { frames?: unknown[]; status?: number };
export type DsQueryEntry = {
  refId: string;
  expr?: string;
  legendFormat?: string;
  response: CapturedResponse;
};
export type VolumeEntry = {
  metric: Record<string, string>;
  value: [number, string];
};

export const dsQuery = dsQueryData as DsQueryEntry[];
export const volume = volumeData as VolumeEntry[];

/** Wrap a list of metric entries in the standard `/index/volume` envelope. */
export function buildVolumeResponse(entries: VolumeEntry[]) {
  return {
    data: {
      result: entries,
      resultType: 'vector' as const,
      stats: volumeStats,
    },
    status: 'success' as const,
  };
}

/** Default `/index/volume` response: the full canonical service list. */
export const volumeResponse = buildVolumeResponse(volume);

/**
 * Tests that count `/index/volume` responses (e.g. "refresh re-queries panels")
 * need the response value to change every call. Otherwise Grafana's panel cache
 * sees the same payload, decides nothing changed, and skips the panel re-query.
 *
 * `nextIncrementingVolumeResponse()` returns a fresh response whose first entry
 * gets a bumped value on every call, mirroring the pre-refactor incrementing
 * mock behavior.
 */
let volumeIncrement = 0;
export function nextIncrementingVolumeResponse() {
  const entries = volume.map((entry, idx) => {
    if (idx !== 0) {
      return entry;
    }
    const [ts, value] = entry.value;
    return { ...entry, value: [ts, (Number(value) + volumeIncrement).toString()] as [number, string] };
  });
  volumeIncrement += 1;
  return buildVolumeResponse(entries);
}

/** Default `/resources/labels` response. */
export const labelsList = {
  data: ['__aggregated_metric__', '__stream_shard__', 'cluster', 'env', 'level', 'namespace', 'service_name'],
  status: 'success' as const,
};

/** Default `/resources/series` response. */
export const series = {
  status: 'success' as const,
  data: [] as Array<Record<string, string>>,
};

/** Default `/logsdrilldowndefaultlabels` response (no defaults configured). */
export const defaultLabels = {
  kind: 'LogsDrilldownDefaultLabelsList' as const,
  apiVersion: 'logsdrilldown.grafana.app/v1beta1' as const,
  metadata: { resourceVersion: '1' },
  items: [] as Array<{
    metadata: { name: string };
    spec: { records: Array<{ label: string; values: string[] }> };
  }>,
};

/** Default `/resources/drilldown-limits` response — mirrors a real `runtime_config`. */
export const drilldownLimits = {
  limits: {
    discover_log_levels: true,
    discover_service_name: [
      'service',
      'app',
      'application',
      'app_name',
      'name',
      'app_kubernetes_io_name',
      'container',
      'container_name',
      'k8s_container_name',
      'component',
      'workload',
      'job',
      'k8s_job_name',
    ],
    log_level_fields: [
      'level',
      'LEVEL',
      'Level',
      'Severity',
      'severity',
      'SEVERITY',
      'lvl',
      'LVL',
      'Lvl',
      'severity_text',
      'Severity_Text',
      'SEVERITY_TEXT',
    ],
    max_entries_limit_per_query: 5000,
    max_line_size_truncate: false,
    max_query_bytes_read: '0B',
    max_query_length: '0s',
    max_query_lookback: '0s',
    max_query_range: '0s',
    max_query_series: 500,
    metric_aggregation_enabled: false,
    otlp_config: {
      LogAttributes: null,
      ResourceAttributes: {
        AttributesConfig: [
          {
            Action: 'index_label',
            Attributes: [
              'service.name',
              'service.namespace',
              'service.instance.id',
              'deployment.environment',
              'deployment.environment.name',
              'cloud.region',
              'cloud.availability_zone',
              'k8s.cluster.name',
              'k8s.namespace.name',
              'k8s.pod.name',
              'k8s.container.name',
              'container.name',
              'k8s.replicaset.name',
              'k8s.deployment.name',
              'k8s.statefulset.name',
              'k8s.daemonset.name',
              'k8s.cronjob.name',
              'k8s.job.name',
            ],
            Regex: '',
          },
        ],
        IgnoreDefaults: false,
      },
      ScopeAttributes: null,
      SeverityTextAsLabel: false,
    },
    pattern_persistence_enabled: true,
    query_timeout: '1m',
    retention_period: '30d',
    volume_enabled: true,
    volume_max_series: 1000,
  },
  pattern_ingester_enabled: true,
  version: '3.6.8',
};
