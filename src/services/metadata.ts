import { ServiceSceneCustomState } from '../Components/ServiceScene/ServiceScene';

let metadataService: MetadataService;

export function initializeMetadataService(): void {
  if (!metadataService) {
    metadataService = new MetadataService();
  }
}

/**
 * Singleton class for sharing state across drilldown routes with common parent scene
 */
export class MetadataService {
  private serviceSceneState: ServiceSceneCustomState | undefined = undefined;
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
}

export function getMetadataService(): MetadataService {
  return metadataService;
}
