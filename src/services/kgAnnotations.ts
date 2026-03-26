import { config } from '@grafana/runtime';
import { dataLayers, SceneDataLayerSet } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';

import { KgAnnotationToggle } from './KgAnnotationToggle';

const KG_DATASOURCE_TYPE = 'grafana-knowledgegraph-datasource';
const KG_DATASOURCE_UID = 'grafanacloud-knowledgegraph';

interface KgSceneProps {
  $data: SceneDataLayerSet;
  controls: KgAnnotationToggle;
}

function isKgAnnotationsAvailable(): boolean {
  if (!(config.featureToggles as Record<string, boolean | undefined>)['kgAnnotationsInLokiExplore']) {
    return false;
  }
  return Object.values(config.datasources).some((d) => d.uid === KG_DATASOURCE_UID);
}

export function getKgSceneProps(entityType: string, entityName?: string): KgSceneProps | undefined {
  if (!isKgAnnotationsAvailable()) {
    return undefined;
  }

  const severities = [
    { value: 'critical', color: 'red', label: 'Critical' },
    { value: 'warning', color: 'orange', label: 'Warning' },
    { value: 'info', color: 'blue', label: 'Info' },
  ] as const;

  const filterCriteria = [
    {
      entityType,
      ...(entityName
        ? { propertyMatchers: [{ id: -1, name: 'name', op: '=', value: entityName, type: 'String' }] }
        : {}),
    },
  ];

  const layers = severities.map(
    (s) =>
      new dataLayers.AnnotationsDataLayer({
        name: `Insights - ${s.label}`,
        isEnabled: true,
        isHidden: true,
        query: {
          datasource: { type: KG_DATASOURCE_TYPE, uid: KG_DATASOURCE_UID },
          enable: true,
          iconColor: s.color,
          name: `KG Assertions - ${s.label}`,
          target: {
            refId: `kgAnnotations-${s.value}`,
            queryType: 'annotations',
            queryMode: 'advanced',
            severityFilter: [s.value],
            advancedQuery: { filterCriteria },
          } as unknown as DataQuery,
        },
      })
  );

  const layerSet = new SceneDataLayerSet({ name: 'Insights', layers });

  return {
    $data: layerSet,
    controls: new KgAnnotationToggle({ layerSet, isEnabled: true }),
  };
}
