import React, { useMemo } from 'react';
import { DataFrame, DataSourceJsonData, TimeRange } from '@grafana/data';
import { DataSourceWithBackend, usePluginLinks } from '@grafana/runtime';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState, SceneQueryRunner } from '@grafana/scenes';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { IconButton } from '@grafana/ui';
import { getLokiDatasource } from 'services/scenes';

export interface AddToExplorationButtonState extends SceneObjectState {
  frame?: DataFrame;
  ds?: DataSourceWithBackend<DataQuery, DataSourceJsonData>;
  labelName?: string;
  fieldName?: string;
}

type ExtensionContext = {
  timeRange: TimeRange;
  queries: DataQuery[];
  datasource: DataSourceRef;
  origin: string;
  url: string;
  type: string;
  title: string;
  note?: string;
  id: string;
};

export class AddToExplorationButton extends SceneObjectBase<AddToExplorationButtonState> {
  constructor(state: AddToExplorationButtonState) {
    super(state);
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    getLokiDatasource(this).then((ds) => {
      this.setState({ ds });
    });
  };

  public static Component = ({ model }: SceneComponentProps<AddToExplorationButton>) => {
    const { ds, frame, labelName, fieldName } = model.useState();

    const data = sceneGraph.getData(model);
    const sqr = sceneGraph.findObject(data, (o) => o instanceof SceneQueryRunner) as SceneQueryRunner;

    const queries = useMemo(() => {
      return sqr?.state.queries.map((q) => ({
        ...q,
        expr: sceneGraph.interpolate(sqr, q.expr),
        legendFormat: sceneGraph.interpolate(sqr, q.legendFormat),
      }));
    }, [sqr]);

    const datasourceUid = ds?.uid;
    const timeRange = sceneGraph.getTimeRange(model);

    useMemo(() => {
      if (frame) {
        const filter = getFilter(frame);
        queries?.forEach((query: DataQuery & { legendFormat: string }) => {
          if (filter) {
            query.legendFormat = `{{${filter.name}}}`;
          }
        });
      }
    }, [frame, queries]);

    const extensionPointId = 'grafana-lokiexplore-app/metric-exploration/v1';
    const context = useMemo<ExtensionContext | undefined>(() => {
      if (!timeRange || !queries || !datasourceUid) {
        return;
      }
      return {
        timeRange: { ...timeRange.state.value },
        type: 'timeseries',
        queries,
        datasource: { uid: datasourceUid },
        origin: 'Explore Logs',
        url: window.location.href,
        id: `${JSON.stringify(queries)}${labelName}`,
        title: `${labelName}${fieldName ? ` > ${fieldName}` : ''}`,
      };
    }, [datasourceUid, timeRange, queries, labelName, fieldName]);

    const { links } = usePluginLinks({ extensionPointId, context });

    return (
      <>
        {links
          .filter((link) => link.pluginId === 'grafana-investigations-app')
          .map((link) => (
            <IconButton
              tooltip={link.description}
              disabled={link.category === 'disabled'}
              aria-label="extension-link-to-open-exploration"
              key={link.id}
              name={link.icon ?? 'panel-add'}
              onClick={link.onClick}
            />
          ))}
      </>
    );
  };
}

const getFilter = (frame: DataFrame) => {
  const filterNameAndValueObj = frame.fields[1]?.labels ?? {};
  if (Object.keys(filterNameAndValueObj).length !== 1) {
    return;
  }
  const name = Object.keys(filterNameAndValueObj)[0];
  return { name, value: filterNameAndValueObj[name] };
};
