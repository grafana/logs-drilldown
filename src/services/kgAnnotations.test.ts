import { DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/plugin-compat/datasources';
import {
  AdHocFiltersVariable,
  CustomVariable,
  dataLayers,
  EmbeddedScene,
  SceneFlexLayout,
  SceneVariableSet,
} from '@grafana/scenes';

import { getKgSceneProps, isKgAnnotationsAvailable, labelsForKgAnnotation } from './kgAnnotations';
import { USER_INPUT_ADHOC_VALUE_PREFIX, VAR_DATASOURCE, VAR_LABELS, VAR_METADATA } from './variables';
import { getFeatureFlag } from 'featureFlags/openFeature';

jest.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstanceSettings: jest.fn(),
}));

jest.mock('featureFlags/openFeature', () => ({
  getFeatureFlag: jest.fn(),
}));

const KG_DATASOURCE_UID = 'grafanacloud-knowledgegraph';

describe('isKgAnnotationsAvailable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getFeatureFlag).mockReturnValue(true);
  });

  it('is false without looking up the datasource when the feature flag is off', async () => {
    jest.mocked(getFeatureFlag).mockReturnValue(false);

    await expect(isKgAnnotationsAvailable()).resolves.toBe(false);
    expect(getDataSourceInstanceSettings).not.toHaveBeenCalled();
  });

  it('is true when the knowledge graph datasource exists', async () => {
    jest
      .mocked(getDataSourceInstanceSettings)
      .mockResolvedValue({ uid: KG_DATASOURCE_UID } as DataSourceInstanceSettings);

    await expect(isKgAnnotationsAvailable()).resolves.toBe(true);
    expect(getDataSourceInstanceSettings).toHaveBeenCalledWith(KG_DATASOURCE_UID);
  });

  it('is false when the knowledge graph datasource does not exist', async () => {
    jest.mocked(getDataSourceInstanceSettings).mockResolvedValue(undefined);

    await expect(isKgAnnotationsAvailable()).resolves.toBe(false);
  });
});

describe('labelsForKgAnnotation', () => {
  it('includes structured-metadata equality filters and lets a stream label win on the same key', () => {
    const labels = labelsForKgAnnotation(
      [
        { key: 'service_name', operator: '=', value: 'emailservice' },
        { key: 'pod', operator: '=', value: 'from-stream' },
        { key: 'namespace', operator: '=~', value: 'shop.*' },
      ],
      [
        { key: 'pod', operator: '=', value: `${USER_INPUT_ADHOC_VALUE_PREFIX}emailservice-abc` },
        { key: 'container', operator: '=', value: 'app' },
        { key: 'ignored', operator: '!=', value: 'nope' },
      ]
    );

    expect(labels).toEqual({
      service_name: 'emailservice',
      pod: 'from-stream',
      container: 'app',
    });
  });
});

describe('getKgSceneProps', () => {
  it('returns nothing when the knowledge graph datasource is not available', () => {
    expect(getKgSceneProps(false)).toBeUndefined();
  });

  it('returns the scene props when the knowledge graph datasource is available', () => {
    expect(getKgSceneProps(true)).toEqual(
      expect.objectContaining({
        $data: expect.anything(),
        behaviors: expect.any(Array),
        controls: expect.anything(),
      })
    );
  });

  it('sends the pod structured-metadata filter and the embedder entity type', () => {
    const labels = new AdHocFiltersVariable({
      name: VAR_LABELS,
      filters: [{ key: 'service_name', operator: '=', value: 'emailservice' }],
    });
    const metadata = new AdHocFiltersVariable({
      name: VAR_METADATA,
      filters: [{ key: 'pod', operator: '=', value: 'emailservice-abc' }],
    });
    const datasource = new CustomVariable({
      name: VAR_DATASOURCE,
      query: 'loki-1',
      value: 'loki-1',
    });

    const kg = getKgSceneProps(true, { entityType: 'Pod' });
    if (kg == null) {
      throw new Error('expected knowledge graph scene props');
    }

    const scene = new EmbeddedScene({
      $variables: new SceneVariableSet({ variables: [datasource, labels, metadata] }),
      $behaviors: kg.behaviors,
      body: new SceneFlexLayout({ children: [] }),
    });
    scene.activate();

    const layer = kg.$data.state.layers[0];
    if (!(layer instanceof dataLayers.AnnotationsDataLayer)) {
      throw new Error('expected an annotations data layer');
    }

    expect(layer.state.query.target).toEqual(
      expect.objectContaining({
        fromLabelsQuery: {
          telemetryType: 'log',
          datasourceUid: 'loki-1',
          labels: { service_name: 'emailservice', pod: 'emailservice-abc' },
          entityType: 'Pod',
        },
      })
    );
  });
});
