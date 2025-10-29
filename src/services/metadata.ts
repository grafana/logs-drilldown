import { ServiceSceneCustomState } from '../Components/ServiceScene/ServiceScene';
import { LokiConfig, LokiConfigNotSupported } from './datasourceTypes';

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
  private lokiConfig: LokiConfigState;
  public getServiceSceneState() {
    return this.serviceSceneState;
  }

  public setPatternsCount(count: number) {
    if (!this.serviceSceneState) {
      this.serviceSceneState = {};
    }

    this.serviceSceneState.patternsCount = count;
  }

  public setLabelsCount(count: number) {
    if (!this.serviceSceneState) {
      this.serviceSceneState = {};
    }

    this.serviceSceneState.labelsCount = count;
  }

  public setEmbedded(embedded: boolean) {
    if (!this.serviceSceneState) {
      this.serviceSceneState = {};
    }
    this.serviceSceneState.embedded = embedded;
  }

  public setFieldsCount(count: number) {
    if (!this.serviceSceneState) {
      this.serviceSceneState = {};
    }

    this.serviceSceneState.fieldsCount = count;
  }

  public setServiceSceneState(state: ServiceSceneCustomState) {
    this.serviceSceneState = {
      embedded: state.embedded,
      fieldsCount: state.fieldsCount,
      labelsCount: state.labelsCount,
      loading: state.loading,
      logsCount: state.logsCount,
      patternsCount: state.patternsCount,
      totalLogsCount: state.totalLogsCount,
    };
  }

  public setLokiConfig(lokiConfig: LokiConfig | LokiConfigNotSupported) {
    this.lokiConfig = lokiConfig;
  }

  // Don't call this except to init the IndexScene.lokiConfig state!
  public getLokiConfig() {
    return this.lokiConfig;
  }
}

export function getMetadataService(): MetadataService {
  return metadataService;
}
