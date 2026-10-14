import { config } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  CustomVariable,
  EmbeddedScene,
  SceneFlexLayout,
  SceneVariableSet,
} from '@grafana/scenes';

import { getKgSceneProps, labelsForKgAnnotation } from './kgAnnotations';
import { USER_INPUT_ADHOC_VALUE_PREFIX, VAR_DATASOURCE, VAR_LABELS, VAR_METADATA } from './variables';

jest.mock('featureFlags/openFeature', () => ({
  getFeatureFlag: (name: string) => name === 'drilldown.logs.kgAnnotationsInLokiExplore',
}));

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

describe('getKgSceneProps annotation query', () => {
  const datasources = config.datasources;

  beforeEach(() => {
    config.datasources = {
      ...datasources,
      kg: { uid: 'grafanacloud-knowledgegraph', type: 'grafana-knowledgegraph-datasource', name: 'kg' },
    } as typeof config.datasources;
  });

  afterEach(() => {
    config.datasources = datasources;
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

    const kg = getKgSceneProps({ entityType: 'Pod' });
    expect(kg).toBeDefined();

    const scene = new EmbeddedScene({
      $variables: new SceneVariableSet({ variables: [datasource, labels, metadata] }),
      $behaviors: kg!.behaviors,
      body: new SceneFlexLayout({ children: [] }),
    });
    scene.activate();

    const layer = kg!.$data.state.layers[0];
    const target = layer.state.query.target as { fromLabelsQuery?: Record<string, unknown> };

    expect(target.fromLabelsQuery).toEqual({
      telemetryType: 'log',
      datasourceUid: 'loki-1',
      labels: { service_name: 'emailservice', pod: 'emailservice-abc' },
      entityType: 'Pod',
    });
  });
});
