import { LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords } from '@grafana/api-clients/rtkq/logsdrilldown/v1beta1';
import { sceneGraph, SceneObject } from '@grafana/scenes';

import { DefaultLabelsSettings } from './api';
import { LokiConfig, LokiConfigNotSupported } from './datasourceTypes';
import { ServiceSceneCustomState } from 'Components/ServiceScene/ServiceScene';

export type CountsTimeRange = { from: string; to: string };

let metadataService: MetadataService;

type LokiConfigState = LokiConfig | undefined | LokiConfigNotSupported;
export function initializeMetadataService(force = false): void {
  if (!metadataService || force) {
    metadataService = new MetadataService();
  }
}

/**
 * Singleton class for sharing state across drilldown routes with common parent scene
 */
export class MetadataService {
  private serviceSceneState: ServiceSceneCustomState | undefined = undefined;
  // The raw time range (e.g. `now-1h`/`now`) the stored counts were computed for, see #2049
  private countsTimeRange: CountsTimeRange | undefined = undefined;
  private lokiConfig: LokiConfigState;
  private defaultColumns: Record<string, LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords> = {};
  private defaultLabels: DefaultLabelsSettings | null = null;

  public getServiceSceneState() {
    return this.serviceSceneState;
  }

  public getCountsTimeRange() {
    return this.countsTimeRange;
  }

  // Drop all counts, e.g. when the time range changes and every count is about to be recomputed
  public clearCounts() {
    if (!this.serviceSceneState) {
      return;
    }
    this.serviceSceneState.fieldsCount = undefined;
    this.serviceSceneState.labelsCount = undefined;
    this.serviceSceneState.logsCount = undefined;
    this.serviceSceneState.patternsCount = undefined;
    this.serviceSceneState.totalLogsCount = undefined;
  }

  public setPatternsCount(count: number, range: CountsTimeRange) {
    if (!this.serviceSceneState) {
      this.serviceSceneState = {};
    }

    this.serviceSceneState.patternsCount = count;
    this.countsTimeRange = range;
  }

  public setLabelsCount(count: number, range: CountsTimeRange) {
    if (!this.serviceSceneState) {
      this.serviceSceneState = {};
    }

    this.serviceSceneState.labelsCount = count;
    this.countsTimeRange = range;
  }

  public setEmbedded(embedded: boolean) {
    if (!this.serviceSceneState) {
      this.serviceSceneState = {};
    }
    this.serviceSceneState.embedded = embedded;
  }

  public setFieldsCount(count: number, range: CountsTimeRange) {
    if (!this.serviceSceneState) {
      this.serviceSceneState = {};
    }

    this.serviceSceneState.fieldsCount = count;
    this.countsTimeRange = range;
  }

  public setTotalLogsCount(count: number | undefined, range: CountsTimeRange) {
    if (!this.serviceSceneState) {
      this.serviceSceneState = {};
    }

    this.serviceSceneState.totalLogsCount = count;
    this.countsTimeRange = range;
  }

  public setLogsCount(count: number | undefined, range: CountsTimeRange) {
    if (!this.serviceSceneState) {
      this.serviceSceneState = {};
    }

    this.serviceSceneState.logsCount = count;
    this.countsTimeRange = range;
  }

  public setServiceSceneState(state: ServiceSceneCustomState, range: CountsTimeRange) {
    this.serviceSceneState = {
      embedded: state.embedded,
      fieldsCount: state.fieldsCount,
      labelsCount: state.labelsCount,
      loading: state.loading,
      logsCount: state.logsCount,
      patternsCount: state.patternsCount,
      totalLogsCount: state.totalLogsCount,
    };
    this.countsTimeRange = range;
  }

  public setLokiConfig(lokiConfig: LokiConfig | LokiConfigNotSupported) {
    this.lokiConfig = lokiConfig;
  }

  // Don't call this except to init the IndexScene.lokiConfig state!
  public getLokiConfig() {
    return this.lokiConfig;
  }

  public setDefaultColumns(columns: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords, dsUID: string) {
    this.defaultColumns[dsUID] = columns;
  }

  // Don't call this except to init the indexScene.defaultColumnsRecords state!
  public getDefaultColumns(dsUID: string) {
    return this.defaultColumns[dsUID];
  }

  public setDefaultLabels(defaultLabels: DefaultLabelsSettings | null) {
    this.defaultLabels = defaultLabels;
  }

  public getDefaultLabels() {
    return this.defaultLabels;
  }

  public getDefaultLabelsForDS(dsUID: string) {
    return this.defaultLabels?.[dsUID];
  }

  public getDefaultLabelValuesForDS(dsUID: string, label: string) {
    return this.defaultLabels?.[dsUID]?.find((defaultLabel) => defaultLabel.label === label)?.values;
  }

  public getDefaultLabelForDS(dsUID: string) {
    return this.defaultLabels?.[dsUID]?.[0]?.label;
  }
}

export function getMetadataService(): MetadataService {
  return metadataService;
}

// The raw scene time range, passed with every count write so restores can detect counts from another range
export function getRawTimeRange(sceneRef: SceneObject): CountsTimeRange {
  const { from, to } = sceneGraph.getTimeRange(sceneRef).state;
  return { from, to };
}
