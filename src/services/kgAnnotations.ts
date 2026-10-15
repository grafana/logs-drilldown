import { t } from '@grafana/i18n';
import { getDataSourceInstanceSettings } from '@grafana/plugin-compat/datasources';
import {
  AdHocFilterWithLabels,
  AdHocFiltersVariable,
  dataLayers,
  SceneDataLayerSet,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  sceneGraph,
} from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';

import { KgAnnotationToggle } from './KgAnnotationToggle';
import { stripAdHocFilterUserInputPrefix, VAR_DATASOURCE, VAR_LABELS, VAR_METADATA } from './variables';
import { getFeatureFlag } from 'featureFlags/openFeature';

const KG_DATASOURCE_TYPE = 'grafana-knowledgegraph-datasource';
const KG_DATASOURCE_UID = 'grafanacloud-knowledgegraph';

interface KgSceneProps {
  $data: SceneDataLayerSet;
  behaviors: KgAnnotationBehavior[];
  controls: KgAnnotationToggle;
}

export async function isKgAnnotationsAvailable(): Promise<boolean> {
  const featureEnabled = getFeatureFlag('drilldown.logs.kgAnnotationsInLokiExplore');
  if (!featureEnabled) {
    return false;
  }
  const settings = await getDataSourceInstanceSettings(KG_DATASOURCE_UID);
  return Boolean(settings);
}

export interface KgAnnotationOptions {
  entityType?: string;
}

/**
 * Labels sent to the knowledge-graph fromLabels query. Stream labels and
 * structured-metadata equality filters are both included. For example:
 * `{service_name="emailservice"} | pod="emailservice-abc"`
 */
export function labelsForKgAnnotation(
  streamFilters: AdHocFilterWithLabels[],
  metadataFilters: AdHocFilterWithLabels[]
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const filters of [metadataFilters, streamFilters]) {
    for (const filter of filters) {
      if (filter.operator !== '=') {
        continue;
      }
      const value = stripAdHocFilterUserInputPrefix(filter.value);
      if (!filter.key || value === '') {
        continue;
      }
      labels[filter.key] = value;
    }
  }
  return labels;
}

function createAnnotationLayers(labels: Record<string, string>, datasourceUid: string, entityType?: string) {
  const severities = [
    {
      value: 'critical',
      color: 'red',
      label: t('services.create-annotation-layers.severities.label.critical', 'Critical'),
    },
    {
      value: 'warning',
      color: 'yellow',
      label: t('services.create-annotation-layers.severities.label.warning', 'Warning'),
    },
    { value: 'info', color: 'blue', label: t('services.create-annotation-layers.severities.label.info', 'Info') },
  ] as const;

  return severities.map(
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
            queryMode: 'fromLabels',
            severityFilter: [s.value],
            fromLabelsQuery: {
              telemetryType: 'log',
              datasourceUid,
              labels,
              ...(entityType ? { entityType } : {}),
            },
          } as unknown as DataQuery,
        },
      })
  );
}

interface KgAnnotationBehaviorState extends SceneObjectState {
  entityType?: string;
  layerSet: SceneObjectRef<SceneDataLayerSet>;
  toggle: SceneObjectRef<KgAnnotationToggle>;
}

class KgAnnotationBehavior extends SceneObjectBase<KgAnnotationBehaviorState> {
  private currentLookupKey: string | undefined;

  constructor(state: KgAnnotationBehaviorState) {
    super(state);
    this.addActivationHandler(this._onActivate);
  }

  private _onActivate = () => {
    const labelsVar = sceneGraph.lookupVariable(VAR_LABELS, this) as AdHocFiltersVariable | undefined;
    if (!labelsVar) {
      return;
    }

    const metadataVar = sceneGraph.lookupVariable(VAR_METADATA, this) as AdHocFiltersVariable | undefined;
    const dsVar = sceneGraph.lookupVariable(VAR_DATASOURCE, this);

    this.onFiltersChanged(labelsVar, metadataVar, dsVar);

    const subs = [
      labelsVar.subscribeToState(() => {
        this.onFiltersChanged(labelsVar, metadataVar, dsVar);
      }),
    ];

    if (metadataVar) {
      subs.push(
        metadataVar.subscribeToState(() => {
          this.onFiltersChanged(labelsVar, metadataVar, dsVar);
        })
      );
    }

    if (dsVar) {
      subs.push(
        dsVar.subscribeToState(() => {
          this.onFiltersChanged(labelsVar, metadataVar, dsVar);
        })
      );
    }

    return () => {
      subs.forEach((s) => s.unsubscribe());
    };
  };

  private onFiltersChanged(
    labelsVar: AdHocFiltersVariable,
    metadataVar: AdHocFiltersVariable | undefined,
    dsVar: ReturnType<typeof sceneGraph.lookupVariable> | undefined
  ) {
    const labels = labelsForKgAnnotation(labelsVar.state.filters, metadataVar?.state.filters ?? []);

    const datasourceUid = (dsVar?.getValue() as string) || '';
    const entityType = this.state.entityType;
    const lookupKey = `${datasourceUid}::${entityType ?? ''}::${JSON.stringify(labels)}`;

    if (lookupKey === this.currentLookupKey) {
      return;
    }
    this.currentLookupKey = lookupKey;

    const layerSet = this.state.layerSet.resolve();
    const toggle = this.state.toggle.resolve();

    if (Object.keys(labels).length > 0 && datasourceUid) {
      const layers = createAnnotationLayers(labels, datasourceUid, entityType);
      layerSet.setState({ layers });
      toggle.syncLayerEnabledState();
    } else {
      layerSet.setState({ layers: [] });
    }
  }
}

export function getKgSceneProps(
  kgAnnotationsAvailable: boolean,
  options?: KgAnnotationOptions
): KgSceneProps | undefined {
  if (!kgAnnotationsAvailable) {
    return undefined;
  }

  const layerSet = new SceneDataLayerSet({ name: 'Insights', layers: [] });

  const toggle = new KgAnnotationToggle({
    isEnabled: true,
    layerSetRef: new SceneObjectRef(layerSet),
  });

  const behavior = new KgAnnotationBehavior({
    layerSet: new SceneObjectRef(layerSet),
    toggle: new SceneObjectRef(toggle),
    entityType: options?.entityType,
  });

  return {
    $data: layerSet,
    behaviors: [behavior],
    controls: toggle,
  };
}
