import React from 'react';

import { DataFrame, FieldConfig, FieldConfigSource, TimeRange } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';
import { IconButton } from '@grafana/ui';

import LokiLogo from '../../../img/logo.svg';
import { LokiDatasource, LokiQuery } from '../../../services/lokiQuery';
import { interpolateExpression } from '../../../services/query';
import { ExtensionPoints } from 'services/extensions/links';
import { findObjectOfType, getLokiDatasource } from 'services/scenes';

export interface AddToInvestigationButtonState extends SceneObjectState {
  context?: ExtensionContext;
  ds?: LokiDatasource;
  fieldName?: string;
  frame?: DataFrame;
  labelName?: string;
  queries: LokiQuery[];
  type?: 'timeseries' | 'logs' | undefined;
}

type ExtensionContext = {
  datasource: DataSourceRef;
  drillDownLabel?: string;
  fieldConfig?: FieldConfigSource;
  id: string;
  logoPath: string;
  note?: string;
  origin: string;
  queries: LokiQuery[];
  timeRange: TimeRange;
  title: string;
  type: string;
  url: string;
};

export class AddToInvestigationButton extends SceneObjectBase<AddToInvestigationButtonState> {
  constructor(state: Omit<AddToInvestigationButtonState, 'queries'>) {
    super({ ...state, queries: [] });
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    getLokiDatasource(this).then((ds) => {
      this.setState({ ds });
    });

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (!this.state.queries.length) {
          this.getQueries();
        }

        if (!this.state.context && this.state.queries.length) {
          this.getContext();
        }
      })
    );
  };

  private getQueries = () => {
    const data = sceneGraph.getData(this);
    const queryRunner = findObjectOfType(data, (o) => o instanceof SceneQueryRunner, SceneQueryRunner);

    if (queryRunner) {
      const filter = this.state.frame ? getFilter(this.state.frame) : null;
      const queries = queryRunner.state.queries.map((q) => ({
        ...q,
        datasource: q.datasource ?? undefined,
        expr: interpolateExpression(queryRunner, q.expr),
        legendFormat: filter?.name ? `{{ ${filter.name} }}` : sceneGraph.interpolate(queryRunner, q.legendFormat),
      }));

      if (JSON.stringify(queries) !== JSON.stringify(this.state.queries)) {
        this.setState({ queries });
      }
    }
  };

  private getFieldConfig = () => {
    const panel = findObjectOfType(this, (o) => o instanceof VizPanel, VizPanel);
    const data = sceneGraph.getData(this);
    const frames = data?.state.data?.series;
    let fieldConfig = panel?.state.fieldConfig;
    if (fieldConfig && frames?.length) {
      for (const frame of frames) {
        for (const field of frame.fields) {
          const configKeys = Object.keys(field.config);
          const properties = configKeys.map((key) => ({
            id: key,
            value: field.config[key as keyof FieldConfig],
          }));

          // check if the override already exists
          const existingOverride = fieldConfig.overrides.find(
            (o) =>
              o.matcher.options === (field.config.displayNameFromDS ?? field.config.displayName ?? field.name) &&
              o.matcher.id === 'byName'
          );
          if (!existingOverride) {
            // add as first override
            fieldConfig.overrides.unshift({
              matcher: {
                id: 'byName',
                options: field.config.displayNameFromDS ?? field.config.displayName ?? field.name,
              },
              properties,
            });
          }

          if (existingOverride && JSON.stringify(existingOverride.properties) !== JSON.stringify(properties)) {
            existingOverride.properties = properties;
          }
        }
      }
    }
    return fieldConfig;
  };

  private getContext = () => {
    const fieldConfig = this.getFieldConfig();
    const { ds, fieldName, labelName, queries, type } = this.state;
    const timeRange = sceneGraph.getTimeRange(this);

    if (!timeRange || !queries || !ds?.uid) {
      return;
    }
    const ctx = {
      datasource: { uid: ds.uid },
      drillDownLabel: fieldName,
      fieldConfig: fieldConfig,
      id: `${JSON.stringify(queries)}${labelName}${fieldName}`,
      logoPath: LokiLogo,
      origin: 'Grafana Logs Drilldown',
      queries,
      timeRange: { ...timeRange.state.value },
      title: `${labelName}${fieldName ? ` > ${fieldName}` : ''}`,
      type: type ?? 'timeseries',
      url: window.location.href,
    };
    if (JSON.stringify(ctx) !== JSON.stringify(this.state.context)) {
      this.setState({ context: ctx });
    }
  };

  public static Component = ({ model }: SceneComponentProps<AddToInvestigationButton>) => {
    const { context } = model.useState();
    const { links } = usePluginLinks({ context, extensionPointId: ExtensionPoints.MetricInvestigation });

    return (
      <>
        {links
          .filter((link) => link.pluginId === 'grafana-investigations-app' && link.onClick)
          .map((link) => (
            <IconButton
              tooltip={link.description}
              aria-label="extension-link-to-open-exploration"
              key={link.id}
              name={link.icon ?? 'panel-add'}
              onClick={(e) => {
                if (link.onClick) {
                  link.onClick(e);
                }
              }}
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
