import {
  AdHocFiltersVariable,
  AdHocFilterWithLabels,
  SceneComponentProps,
  SceneDataState,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableValueChangedEvent,
} from '@grafana/scenes';
import React from 'react';
import { JSONTree, KeyPath } from '@gtk-grafana/react-json-tree';
import { getLogsPanelFrame, ServiceScene } from './ServiceScene';
import {
  AdHocVariableFilter,
  dateTimeFormat,
  FieldType,
  getTimeZone,
  GrafanaTheme2,
  LoadingState,
  PanelData,
} from '@grafana/data';
import { IconButton, LoadingPlaceholder, PanelChrome, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { PanelMenu } from '../Panels/PanelMenu';
import { LogsListScene } from './LogsListScene';
import { getVariableForLabel } from '../../services/fields';
import { addAdHocFilter } from './Breakdowns/AddToFiltersButton';
import { FilterOp } from '../../services/filterTypes';
import { getPrettyQueryExpr } from '../../services/scenes';
import { getFieldsVariable, getJsonFieldsVariable, getJsonOnlyParserVariable } from '../../services/variableGetters';
import { EMPTY_VARIABLE_VALUE } from '../../services/variables';
import { isNumber } from 'lodash';
import { css } from '@emotion/css';
import { hasProp } from '../../services/narrowing';

interface LogsJsonSceneState extends SceneObjectState {
  menu?: PanelMenu;
  filterJson: 'All' | 'JSON';
  data?: PanelData;
}

type NodeTypeLoc = 'String' | 'Boolean' | 'Number' | 'Custom' | 'Object' | 'Array';
export class LogsJsonScene extends SceneObjectBase<LogsJsonSceneState> {
  constructor(state: Partial<LogsJsonSceneState>) {
    super({ ...state, filterJson: 'All' });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public getValue(keyPath: KeyPath, nodeType: NodeTypeLoc, lineField: Array<string | number>): string | number {
    // console.log('getValue', {keyPath, nodeType, lineField})
    const keys = [...keyPath];
    const accessors = [];

    while (keys.length) {
      const key = keys.pop();
      // console.log('k', key)

      if (key !== 'root' && key !== undefined) {
        accessors.push(key);
      }
    }

    return getNestedProperty(lineField, accessors);
  }

  public toggleJson(state: 'All' | 'JSON') {
    // @todo set query filter instead of client-side filter
    this.setState({
      filterJson: state,
    });

    const jsonVariable = getJsonOnlyParserVariable(this);
    if (state === 'All') {
      jsonVariable.changeValueTo('');
    } else {
      jsonVariable.changeValueTo('| json | __error__!="JSONParserErr"');
    }

    const $data = sceneGraph.getData(this);
    this.updateJsonFrame($data.state);
  }

  public static Component = ({ model }: SceneComponentProps<LogsJsonScene>) => {
    // const styles = getStyles(grafanaTheme)
    const { menu, data } = model.useState();
    const $data = sceneGraph.getData(model);
    const {} = $data.useState();
    const parentModel = sceneGraph.getAncestor(model, LogsListScene);
    const { visualizationType } = parentModel.useState();
    const styles = useStyles2(getStyles);

    const dataFrame = getLogsPanelFrame(data);
    const lineField = dataFrame?.fields.find(
      (field) => field.type === FieldType.string && (field.name === 'Line' || field.name === 'body')
    );

    const addFilter = (filter: AdHocVariableFilter, nodeType: NodeTypeLoc) => {
      // @todo labels in JSON do not match labels from Loki
      filter.key = filter.key.replace(/-/g, '_');
      // console.log('addFilter json', nodeType, filter);

      // If the node is a parent node, we want to set the json parser parameter for that key
      const jsonVariable = getJsonFieldsVariable(model);
      jsonVariable.setState({
        filters: [...jsonVariable.state.filters, { value: filter.value, key: filter.key, operator: filter.operator }],
      });

      const variableType = getVariableForLabel(dataFrame, filter.key, model);
      addAdHocFilter(filter, parentModel, variableType);
    };

    return (
      <PanelChrome
        loadingState={$data.state.data?.state}
        title={'Logs'}
        menu={menu ? <menu.Component model={menu} /> : undefined}
        actions={
          <>
            <RadioButtonGroup
              value={model.state.filterJson}
              size={'sm'}
              onChange={(label: 'All' | 'JSON') => model.toggleJson(label)}
              options={[
                { label: 'All', value: 'All' },
                { label: 'JSON', value: 'JSON' },
              ]}
            />
            <LogsPanelHeaderActions vizType={visualizationType} onChange={parentModel.setVisualizationType} />
          </>
        }
      >
        {!lineField?.values && (
          <>
            <LoadingPlaceholder text={'Loading...'} />
          </>
        )}

        {lineField?.values && (
          <span className={styles.JSONTreeWrap}>
            <JSONTree
              data={lineField.values}
              getItemString={(nodeType, data, itemType, itemString) => {
                console.log('getItemString', { nodeType, data, itemType, itemString });
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
              labelRenderer={(keyPath, nodeType, expanded) => {
                const nodeTypeLoc = nodeType as NodeTypeLoc;
                const keyPathString = keyPath[0] !== 'Time' ? keyPath[0] + ':' : keyPath[0];

                if (
                  nodeTypeLoc !== 'Object' &&
                  nodeTypeLoc !== 'Array' &&
                  keyPath[0] !== 'Time' &&
                  keyPath[0] !== 'Line' &&
                  keyPath[0] !== 'root' &&
                  !isNumber(keyPath[0])
                ) {
                  return (
                    <>
                      <span className={styles.labelButtonsWrap}>
                        <IconButton
                          className={styles.filterButton}
                          onClick={() =>
                            addFilter(
                              {
                                key: keyPath[0].toString(),
                                value: model.getValue(keyPath, nodeTypeLoc, lineField.values).toString(),
                                operator: FilterOp.Equal,
                              },
                              nodeTypeLoc
                            )
                          }
                          size={'md'}
                          name={'plus-circle'}
                          aria-label={'add filter'}
                        />
                        <IconButton
                          className={styles.filterButton}
                          onClick={() => {
                            addFilter(
                              {
                                key: keyPath[0].toString(),
                                value: model.getValue(keyPath, nodeTypeLoc, lineField.values).toString(),
                                operator: FilterOp.NotEqual,
                              },
                              nodeTypeLoc
                            );
                          }}
                          size={'md'}
                          name={'minus-circle'}
                          aria-label={'remove filter'}
                        />

                        <strong className={styles.labelWrap}>{keyPathString}</strong>
                      </span>
                    </>
                  );
                } else if (
                  (nodeTypeLoc === 'Object' || nodeTypeLoc === 'Array') &&
                  keyPath[0] !== 'Line' &&
                  keyPath[0] !== 'root' &&
                  !isNumber(keyPath[0])
                ) {
                  return (
                    <>
                      <span className={styles.labelWrap}>
                        <IconButton
                          className={styles.filterButton}
                          onClick={() =>
                            addFilter(
                              {
                                key: keyPath[0].toString(),
                                value: EMPTY_VARIABLE_VALUE,
                                operator: FilterOp.NotEqual,
                              },
                              nodeTypeLoc
                            )
                          }
                          size={'md'}
                          name={'plus-circle'}
                          aria-label={'add filter'}
                        />
                        <IconButton
                          className={styles.filterButton}
                          onClick={() => {
                            addFilter(
                              {
                                key: keyPath[0].toString(),
                                value: EMPTY_VARIABLE_VALUE,
                                operator: FilterOp.Equal,
                              },
                              nodeTypeLoc
                            );
                          }}
                          size={'md'}
                          name={'minus-circle'}
                          aria-label={'remove filter'}
                        />
                        <strong>{keyPathString}</strong>
                      </span>
                    </>
                  );
                }

                if (isNumber(keyPath[0]) && keyPath[1] === 'root') {
                  const time = lineField.values[keyPath[0]]?.Time;
                  // console.log('render root nodes', {keyPath, nodeTypeLoc, line: lineField.values[keyPath[0]]})
                  return <strong className={styles.timeNode}>{time}</strong>;
                }

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

    const fieldsVariable = getFieldsVariable(this);
    this._subs.add(
      // Hacky sync on field filter updates, this will result in duplicate queries
      fieldsVariable.subscribeToEvent(SceneVariableValueChangedEvent, (evt) => {
        // console.log('fields changed event', evt)
        const state = evt.payload.state as AdHocFiltersVariable['state'];
        const fieldFilters = state.filters;

        const jsonVariable = getJsonFieldsVariable(this);
        let newJsonFilters: AdHocFilterWithLabels[] = [];

        jsonVariable.state.filters.forEach((jsonField) => {
          if (fieldFilters.find((fieldFilter) => fieldFilter.key === jsonField.key)) {
            newJsonFilters.push(jsonField);
          }
        });

        // console.log('need to remove dups', newJsonFilters)
        jsonVariable.setState({
          filters: newJsonFilters,
        });
      })
    );
  }

  private updateJsonFrame(newState: SceneDataState) {
    const dataFrame = getLogsPanelFrame(newState.data);
    const time = dataFrame?.fields.find((field) => field.type === FieldType.time);
    // const timeNs = dataFrame?.fields.find(field => field.type === FieldType.string && field.name === 'tsNs')
    // const labels = dataFrame?.fields.find((field) => field.type === FieldType.other && field.name === 'labels');
    // const labelTypes = dataFrame?.fields.find(field => field.type === FieldType.other && field.name === 'labelTypes')

    const timeZone = getTimeZone();
    if (newState.data) {
      // console.time('json parse')
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
                        console.warn('failed to parse', {
                          e,
                          v,
                        });
                        parsed = v;
                      }

                      return {
                        // @todo ns? This will remove leading zeros
                        Time: renderTimeStamp(time?.values?.[i], timeZone),
                        Line: parsed,
                        // @todo labels? Allow filtering when key has same name as label?
                        // Labels: labels?.values[i],
                        // LabelTypes: labelTypes?.values[i]
                      };
                      // return parsed;
                      // remove null
                    })
                    .filter((f) => f),
                };
              }
              return f;
            }),
          };
        }),
      };
      // console.timeEnd('json parse')
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
  timeNode: css({
    color: theme.colors.text.maxContrast,
  }),
  // Library uses inline styles
  labelButtonsWrap: css({
    display: 'inline-flex',

    color: 'var(--json-tree-label-color)',
  }),
  labelWrap: css({
    color: 'var(--json-tree-label-color)',
    display: 'inline-flex',
    alignItems: 'center',
  }),
  filterButton: css({
    // marginLeft: '0.25em',
    // marginRight: '0.25em',
    // display: 'inline-flex',
    // verticalAlign: 'middle',
  }),
  JSONTreeWrap: css`
    // override css
    --json-tree-align-items: flex-start;
  `,
});
