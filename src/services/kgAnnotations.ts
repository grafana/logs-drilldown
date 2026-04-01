import { config } from '@grafana/runtime';
import {
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
import { VAR_DATASOURCE, VAR_LABELS } from './variables';
import { getFeatureFlag } from 'featureFlags/openFeature';

const KG_DATASOURCE_TYPE = 'grafana-knowledgegraph-datasource';
const KG_DATASOURCE_UID = 'grafanacloud-knowledgegraph';

interface KgSceneProps {
  $data: SceneDataLayerSet;
  behaviors: KgAnnotationBehavior[];
  controls: KgAnnotationToggle;
}

export function isKgAnnotationsAvailable(): boolean {
  const featureEnabled = getFeatureFlag('kgAnnotationsInLokiExplore');
  if (!featureEnabled) {
    return false;
  }
  return Object.values(config.datasources).some((d) => d.uid === KG_DATASOURCE_UID);
}

function createAnnotationLayers(labels: Record<string, string>, datasourceUid: string) {
  const severities = [
    { value: 'critical', color: 'red', label: 'Critical' },
    { value: 'warning', color: 'yellow', label: 'Warning' },
    { value: 'info', color: 'blue', label: 'Info' },
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
            },
          } as unknown as DataQuery,
        },
      })
  );
}

interface KgAnnotationBehaviorState extends SceneObjectState {
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
    const filtersVar = sceneGraph.lookupVariable(VAR_LABELS, this) as AdHocFiltersVariable | undefined;
    if (!filtersVar) {
      return;
    }

    const dsVar = sceneGraph.lookupVariable(VAR_DATASOURCE, this);

    this.onFiltersChanged(filtersVar, dsVar);

    const subs = [
      filtersVar.subscribeToState(() => {
        this.onFiltersChanged(filtersVar, dsVar);
      }),
    ];

    if (dsVar) {
      subs.push(
        dsVar.subscribeToState(() => {
          this.onFiltersChanged(filtersVar, dsVar);
        })
      );
    }

    return () => {
      subs.forEach((s) => s.unsubscribe());
    };
  };

  private onFiltersChanged(
    filtersVar: AdHocFiltersVariable,
    dsVar: ReturnType<typeof sceneGraph.lookupVariable> | undefined
  ) {
    const filters = filtersVar.state.filters.filter((f) => f.operator === '=');
    const labels: Record<string, string> = {};
    for (const f of filters) {
      labels[f.key] = f.value;
    }

    const datasourceUid = (dsVar?.getValue() as string) || '';
    const lookupKey = `${datasourceUid}::${JSON.stringify(labels)}`;

    if (lookupKey === this.currentLookupKey) {
      return;
    }
    this.currentLookupKey = lookupKey;

    const layerSet = this.state.layerSet.resolve();
    const toggle = this.state.toggle.resolve();

    if (Object.keys(labels).length > 0 && datasourceUid) {
      const layers = createAnnotationLayers(labels, datasourceUid);
      layerSet.setState({ layers });
      toggle.syncLayerEnabledState();
    } else {
      layerSet.setState({ layers: [] });
    }
  }
}

export function getKgSceneProps(): KgSceneProps | undefined {
  if (!isKgAnnotationsAvailable()) {
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
  });

  return {
    $data: layerSet,
    behaviors: [behavior],
    controls: toggle,
  };
}
