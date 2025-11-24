import { DataQueryRequest } from '@grafana/data';
import { SceneObject } from '@grafana/scenes';

import { LokiQuery } from './lokiQuery';

export type SceneDataQueryRequest = DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest & VolumeRequestProps> & {
  scopedVars?: { __sceneObject?: { valueOf: () => SceneObject } };
};
export type SceneDataQueryResourceRequest = {
  resource?: SceneDataQueryResourceRequestOptions;
};

export type SceneDataQueryResourceRequestOptions =
  | 'config'
  | 'detected_fields'
  | 'detected_labels'
  | 'labels'
  | 'patterns'
  | 'volume';

export type VolumeRequestProps = {
  primaryLabel?: string;
};

// @todo update definitions
export type LokiConfig = {
  limits: {
    discover_log_levels: boolean;
    discover_service_name: string[];
    log_level_fields: string[];
    max_entries_limit_per_query: number;
    max_line_size_truncate: boolean;
    max_query_bytes_read: string;
    // 30d1h
    max_query_length: string;
    // 1m, 0s
    max_query_lookback: string;
    // 1m, 0s
    max_query_range: string;
    max_query_series: number;
    metric_aggregation_enabled: boolean;
    otlp_config: {
      LogAttributes: null;
      ResourceAttributes: {
        AttributesConfig: Array<{
          Action: string;
          Attributes: string[];
          Regex: string;
        }>;
        IgnoreDefaults: boolean;
      };
      ScopeAttributes: null;
      SeverityTextAsLabel: boolean;
    };
    pattern_persistence_enabled: boolean;
    // 1m, 0s
    query_timeout: string;
    // 1m, 0s
    retention_period: string;
    volume_enabled: boolean;
    volume_max_series: number;
  };
  pattern_ingester_enabled: boolean;
  // k276-c416352,
  version: 'unknown' | string;
};

export const LOKI_CONFIG_API_NOT_SUPPORTED = 'Not supported';
export type LokiConfigNotSupported = typeof LOKI_CONFIG_API_NOT_SUPPORTED;
