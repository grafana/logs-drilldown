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

export type LokiConfig = {
  limits: {
    discover_log_levels: boolean;
    discover_service_name: string[];
    log_level_fields: string[];
    max_line_size_truncate: boolean;
    max_query_length: string; // "30d1h"
    max_query_lookback: string; // "0s"
    max_query_range: string; // "0s"
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
    // "0s"
    query_timeout: string;
    // "1m"
    retention_period: string;
  };
  pattern_ingester_enabled: boolean;
  version: 'unknown' | string;
};
