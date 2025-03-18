import React from 'react';
import {
  AdHocFiltersVariable,
  AdHocFilterWithLabels,
  SceneComponentProps,
  SceneDataState,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import {
  DataFrame,
  dateTimeFormat,
  Field,
  FieldType,
  getTimeZone,
  GrafanaTheme2,
  LoadingState,
  PanelData,
} from '@grafana/data';
import { IconButton, PanelChrome, useStyles2 } from '@grafana/ui';

import { isNumber } from 'lodash';
import { css } from '@emotion/css';
import { JSONTree, KeyPath } from '@gtk-grafana/react-json-tree';

import { LogsListScene } from './LogsListScene';
import { getLogsPanelFrame, ServiceScene } from './ServiceScene';
import { PanelMenu } from '../Panels/PanelMenu';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { addToFilters, FilterType } from './Breakdowns/AddToFiltersButton';
import { DrilldownButton } from './JSONPanel/DrilldownButton';
import { JSONFilterNestedNodeInButton } from './JSONPanel/JSONFilterNestedNodeInButton';
import { JSONFilterNestedNodeOutButton } from './JSONPanel/JSONFilterNestedNodeOutButton';

import { clearJsonParserFields, isLogLineField } from '../../services/fields';
import { FilterOp, JSONFilterOp } from '../../services/filterTypes';
import { getPrettyQueryExpr } from '../../services/scenes';
import { getFieldsVariable, getLineFormatVariable, getValueFromFieldsFilter } from '../../services/variableGetters';
import { hasProp } from '../../services/narrowing';
import {
  addJsonParserFields,
  addJsonParserFieldValue,
  EMPTY_JSON_FILTER_VALUE,
  getJsonKey,
  removeJsonDrilldownFilters,
} from '../../services/filters';
import { addCurrentUrlToHistory } from '../../services/navigate';
import { EMPTY_VARIABLE_VALUE, VAR_FIELDS } from '../../services/variables';

interface LogsJsonSceneState extends SceneObjectState {
  menu?: PanelMenu;
  data?: PanelData;
}

export type NodeTypeLoc = 'String' | 'Boolean' | 'Number' | 'Custom' | 'Object' | 'Array';
export type AddJSONFilter = (
  keyPath: KeyPath,
  key: string,
  value: string,
  filterType: FilterType,
  dataFrame: DataFrame | undefined
) => void;

export class LogsJsonScene extends SceneObjectBase<LogsJsonSceneState> {
  constructor(state: Partial<LogsJsonSceneState>) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public onActivate() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    this.setState({
      menu: new PanelMenu({
        investigationOptions: { type: 'logs', getLabelName: () => `Logs: ${getPrettyQueryExpr(serviceScene)}` },
      }),
    });

    const $data = sceneGraph.getData(this);
    if ($data.state.data?.state === LoadingState.Done) {
      this.updateJsonFrame($data.state);
    }

    this._subs.add(
      $data.subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done) {
          this.updateJsonFrame(newState);
        }
      })
    );
    this.addJsonParserFieldsForCurrentFilters();
    clearJsonParserFields(this);
  }

  private getValue(keyPath: KeyPath, lineField: Array<string | number>): string | number {
    const keys = [...keyPath];
    const accessors = [];

    while (keys.length) {
      const key = keys.pop();

      if (key !== 'root' && key !== undefined) {
        accessors.push(key);
      }
    }

    return getNestedProperty(lineField, accessors);
  }

  /**
   * Drills into node specified by keyPath
   * Note, if we've already drilled down into a node, the keyPath (from the viz) will not have the parent nodes we need to build the json parser fields.
   * We re-create the full key path using the values currently stored in the lineFormat variable
   */
  private addDrilldown = (keyPath: KeyPath) => {
    addCurrentUrlToHistory();
    const lineFormatVar = getLineFormatVariable(this);
    const { fullPathFilters, fullKeyPath } = this.getFullKeyPath(keyPath);

    // If keyPath length is greater than 3 we're drilling down (root, line index, line)
    if (keyPath.length > 3) {
      addJsonParserFields(this, fullKeyPath, true);

      lineFormatVar.setState({
        filters: fullPathFilters,
      });
    } else {
      // Otherwise we're drilling back up to the root
      removeJsonDrilldownFilters(this);
      clearJsonParserFields(this);
    }
  };

  private getFullKeyPath(keyPath: ReadonlyArray<string | number>) {
    const lineFormatVar = getLineFormatVariable(this);

    const fullPathFilters: AdHocFilterWithLabels[] = [
      ...lineFormatVar.state.filters,
      ...keyPath
        // line format filters only store the parent node field names
        .filter((key) => typeof key === 'string' && !isLogLineField(key) && key !== 'root')
        // keyPath order is from child to root, we want to order from root to child
        .reverse()
        // convert to ad-hoc filter
        .map((nodeKey) => ({
          key: nodeKey.toString(),
          // The operator and value are not used when interpolating the variable, but empty values will cause the ad-hoc filter to get removed from the URL state, we work around this by adding an empty space for the value and operator
          // we could store the depth of the node as a value, right now we assume that these filters always include every parent node of the current node, ordered by node depth ASC (root node first)
          operator: JSONFilterOp.Empty,
          value: EMPTY_JSON_FILTER_VALUE,
        })),
    ];

    // the last 3 in the key path are always array
    const fullKeyPath = [...fullPathFilters.map((filter) => filter.key).reverse(), ...keyPath.slice(-3)];
    return { fullPathFilters, fullKeyPath };
  }

  private addFilter: AddJSONFilter = (
    keyPath: KeyPath,
    key: string,
    value: string,
    filterType: FilterType,
    dataFrame: DataFrame | undefined
  ) => {
    addCurrentUrlToHistory();

    // @todo https://github.com/grafana/loki/issues/16817
    if (key.includes('-')) {
      key = key.replace(/-/g, '_');
    }

    addJsonParserFieldValue(this, keyPath);

    const logsListScene = sceneGraph.getAncestor(this, LogsListScene);
    addToFilters(key, value, filterType, logsListScene, VAR_FIELDS, false, true);
  };

  private getKeyPathString(keyPath: KeyPath) {
    return keyPath[0] !== 'Time' ? keyPath[0] + ':' : keyPath[0];
  }

  public static Component = ({ model }: SceneComponentProps<LogsJsonScene>) => {
    // const styles = getStyles(grafanaTheme)
    const { menu, data } = model.useState();
    const $data = sceneGraph.getData(model);
    // Rerender on data change
    const {} = $data.useState();
    const logsListScene = sceneGraph.getAncestor(model, LogsListScene);
    const { visualizationType } = logsListScene.useState();
    const styles = useStyles2(getStyles);
    const lineFormatVar = getLineFormatVariable(model);
    const fieldsVar = getFieldsVariable(model);

    // If we have a line format variable, we are drilled down into a nested node
    const isDrillDown = lineFormatVar.state.filters.length > 0;
    const dataFrame = getLogsPanelFrame(data);
    const lineField = dataFrame?.fields.find(
      (field) => field.type === FieldType.string && (field.name === 'Line' || field.name === 'body')
    );

    return (
      <PanelChrome
        statusMessage={$data.state.data?.errors?.[0].message}
        loadingState={$data.state.data?.state}
        title={'Logs'}
        menu={menu ? <menu.Component model={menu} /> : undefined}
        actions={<LogsPanelHeaderActions vizType={visualizationType} onChange={logsListScene.setVisualizationType} />}
      >
        {dataFrame && lineField?.values && (
          <span className={styles.JSONTreeWrap}>
            <JSONTree
              data={lineField.values}
              getItemString={(nodeType, data, itemType, itemString) => {
                if (data && hasProp(data, 'Time') && typeof data.Time === 'string') {
                  return null;
                }

                return (
                  <span>
                    {itemType} {itemString}
                  </span>
                );
              }}
              valueRenderer={(valueAsString, value, keyPath) => {
                if (keyPath === 'Time') {
                  return null;
                }

                return <>{valueAsString?.toString()}</>;
              }}
              shouldExpandNodeInitially={(keyPath, data, level) => level <= 2}
              labelRenderer={(keyPath, nodeType) => {
                const depth = keyPath.length;
                const nodeTypeLoc = nodeType as NodeTypeLoc;

                if (keyPath[0] === 'root' && isDrillDown) {
                  return model.getNestedNodeDrilldownButtons(keyPath);
                }

                // Value nodes
                if (
                  nodeTypeLoc !== 'Object' &&
                  nodeTypeLoc !== 'Array' &&
                  keyPath[0] !== 'Time' &&
                  keyPath[0] !== 'Line' &&
                  keyPath[0] !== 'root' &&
                  !isNumber(keyPath[0])
                ) {
                  return model.getValueLabel(keyPath, lineField, dataFrame, fieldsVar);
                }

                // Parent nodes
                if (
                  (nodeTypeLoc === 'Object' || nodeTypeLoc === 'Array') &&
                  keyPath[0] !== 'Line' &&
                  keyPath[0] !== 'root' &&
                  !isNumber(keyPath[0])
                ) {
                  if (depth <= 4) {
                    return model.getNestedNodeFilterButtons(keyPath, nodeTypeLoc, dataFrame, fieldsVar);
                  } else {
                    return model.getNestedNodeDrilldownButtons(keyPath);
                  }
                }

                // Show the timestamp as the label of the log line
                if (isNumber(keyPath[0]) && keyPath[1] === 'root') {
                  const time = lineField.values[keyPath[0]]?.Time;
                  return <strong className={styles.timeNode}>{time}</strong>;
                }

                // Don't render time node
                if (keyPath[0] === 'Time') {
                  return null;
                }

                return <strong>{keyPath[0]}:</strong>;
              }}
            />
          </span>
        )}
      </PanelChrome>
    );
  };

  private getNestedNodeDrilldownButtons = (keyPath: KeyPath) => {
    return (
      <>
        <span className={labelWrapStyle}>
          <DrilldownButton keyPath={keyPath} addDrilldown={this.addDrilldown} />
          <strong>{this.getKeyPathString(keyPath)}</strong>
        </span>
      </>
    );
  };

  private getNestedNodeFilterButtons = (
    keyPath: KeyPath,
    nodeTypeLoc: NodeTypeLoc,
    dataFrame: DataFrame,
    fieldsVar: AdHocFiltersVariable
  ) => {
    const { fullKeyPath } = this.getFullKeyPath(keyPath);
    const fullKey = getJsonKey(fullKeyPath);
    const existingFilter = fieldsVar.state.filters.find(
      (f) => f.key === fullKey && getValueFromFieldsFilter(f).value === EMPTY_VARIABLE_VALUE
    );

    return (
      <>
        <span className={labelWrapStyle}>
          <DrilldownButton keyPath={keyPath} addDrilldown={this.addDrilldown} />
          <JSONFilterNestedNodeInButton
            jsonKey={fullKey}
            addFilter={this.addFilter}
            keyPath={fullKeyPath}
            nodeTypeLoc={nodeTypeLoc}
            dataFrame={dataFrame}
            active={existingFilter?.operator === FilterOp.NotEqual}
          />
          <JSONFilterNestedNodeOutButton
            jsonKey={fullKey}
            addFilter={this.addFilter}
            keyPath={fullKeyPath}
            nodeTypeLoc={nodeTypeLoc}
            dataFrame={dataFrame}
            active={existingFilter?.operator === FilterOp.Equal}
          />
          <strong>{this.getKeyPathString(keyPath)}</strong>
        </span>
      </>
    );
  };

  private getValueLabel = (
    keyPath: KeyPath,
    lineField: Field<string | number>,
    dataFrame: DataFrame,
    fieldsVar: AdHocFiltersVariable
  ) => {
    // @todo clean up styles
    const styles = useStyles2(getValueLabelStyles);

    const value = this.getValue(keyPath, lineField.values)?.toString();
    const { fullKeyPath } = this.getFullKeyPath(keyPath);
    const fullKey = getJsonKey(fullKeyPath);
    const existingFilter = fieldsVar.state.filters.find(
      (f) => f.key === fullKey && getValueFromFieldsFilter(f).value === value
    );

    return (
      <>
        <span className={styles.labelButtonsWrap}>
          <IconButton
            tooltip={`Include log lines containing ${value}`}
            onClick={(e) => {
              e.stopPropagation();
              this.addFilter(
                fullKeyPath,
                fullKey,
                value,
                existingFilter?.operator === FilterOp.Equal ? 'toggle' : 'include',
                dataFrame
              );
            }}
            variant={existingFilter?.operator === FilterOp.Equal ? 'primary' : 'secondary'}
            size={'md'}
            name={'search-plus'}
            aria-label={'add filter'}
          />
          <IconButton
            tooltip={`Exclude log lines containing ${value}`}
            onClick={(e) => {
              e.stopPropagation();
              this.addFilter(
                fullKeyPath,
                fullKey,
                value,
                existingFilter?.operator === FilterOp.NotEqual ? 'toggle' : 'exclude',
                dataFrame
              );
            }}
            variant={existingFilter?.operator === FilterOp.NotEqual ? 'primary' : 'secondary'}
            size={'md'}
            name={'search-minus'}
            aria-label={'remove filter'}
          />

          <strong className={styles.labelWrap}>{this.getKeyPathString(keyPath)}</strong>
        </span>
      </>
    );
  };

  private addJsonParserFieldsForCurrentFilters() {
    // @todo https://github.com/grafana/loki/issues/16816
    // Need to add json parser prop for any nested json field, or field filters from the "Fields" tab will break if the user has other JSON parser props defined by interacting in the viz.
  }

  private updateJsonFrame(newState: SceneDataState) {
    const dataFrame = getLogsPanelFrame(newState.data);
    const time = dataFrame?.fields.find((field) => field.type === FieldType.time);
    // const timeNs = dataFrame?.fields.find(field => field.type === FieldType.string && field.name === 'tsNs')
    // const labels = dataFrame?.fields.find((field) => field.type === FieldType.other && field.name === 'labels');
    // const labelTypes = dataFrame?.fields.find(field => field.type === FieldType.other && field.name === 'labelTypes')

    const timeZone = getTimeZone();
    if (newState.data) {
      const transformedData: PanelData = {
        ...newState.data,
        series: newState.data.series.map((frame) => {
          return {
            ...frame,

            fields: frame.fields.map((f) => {
              if (f.name === 'Line') {
                return {
                  ...f,
                  values: f.values
                    .map((v, i) => {
                      let parsed;
                      try {
                        parsed = JSON.parse(v);
                      } catch (e) {
                        // @todo
                        console.warn('failed to parse', {
                          e,
                          v,
                        });
                        parsed = v;
                      }

                      return {
                        Time: renderTimeStamp(time?.values?.[i], timeZone),
                        Line: parsed,
                        // @todo add support for structured metadata
                        // Labels: labels?.values?.[0],
                      };
                    })
                    .filter((f) => f),
                };
              }
              return f;
            }),
          };
        }),
      };
      this.setState({
        data: transformedData,
      });
    }
  }
}

const renderTimeStamp = (epochMs: number, timeZone?: string) => {
  return dateTimeFormat(epochMs, {
    timeZone: timeZone,
    defaultWithMS: true,
  });
};

function getNestedProperty(obj: Record<string, any>, props: Array<string | number>): any {
  if (props.length === 1) {
    return obj[props[0]];
  }
  const prop = props.shift();
  if (prop !== undefined) {
    return getNestedProperty(obj[prop], props);
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  JSONTreeWrap: css`
    // override css variables
    --json-tree-align-items: flex-start;
    --json-tree-label-color: ${theme.isDark ? '#73bf69' : '#56a64b'};
    --json-tree-label-value-color: ${theme.isDark ? '#ce9178' : '#a31515'};
    --json-tree-arrow-color: ${theme.colors.secondary.contrastText};
  `,
  timeNode: css({
    // color: theme.colors.text.maxContrast,
  }),
});

const labelWrapStyle = css({
  color: 'var(--json-tree-label-color)',
  display: 'inline-flex',
  alignItems: 'center',
});
const getValueLabelStyles = (theme: GrafanaTheme2) => ({
  labelButtonsWrap: css({
    display: 'inline-flex',
    color: 'var(--json-tree-label-color)',
  }),
  labelWrap: labelWrapStyle,
});
