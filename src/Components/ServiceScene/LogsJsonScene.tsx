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
import {JSONTree, KeyPath} from '@gtk-grafana/react-json-tree';
import {getLogsPanelFrame, ServiceScene} from './ServiceScene';
import {
    AdHocVariableFilter,
    DataFrame,
    dateTimeFormat,
    Field,
    FieldType,
    getTimeZone,
    GrafanaTheme2,
    LoadingState,
    PanelData,
} from '@grafana/data';
import {IconButton, LoadingPlaceholder, PanelChrome, RadioButtonGroup, useStyles2} from '@grafana/ui';
import {LogsPanelHeaderActions} from '../Table/LogsHeaderActions';
import {PanelMenu} from '../Panels/PanelMenu';
import {LogsListScene} from './LogsListScene';
import {getVariableForLabel} from '../../services/fields';
import {addToFilters} from './Breakdowns/AddToFiltersButton';
import {FilterOp} from '../../services/filterTypes';
import {getPrettyQueryExpr} from '../../services/scenes';
import {
    getFieldsVariable,
    getJsonFieldsVariable,
    getJsonOnlyParserVariable,
    getLineFormatVariable
} from '../../services/variableGetters';
import {isNumber} from 'lodash';
import {css} from '@emotion/css';
import {hasProp} from '../../services/narrowing';
import {addJsonParserFields, getJsonKey, removeJsonDrilldownFilters} from "../../services/filters";
import {DrilldownButton} from "./JSONPanel/DrilldownButton";
import {JSONFilterNestedNodeInButton} from "./JSONPanel/JSONFilterNestedNodeInButton";
import {JSONFilterNestedNodeOutButton} from "./JSONPanel/JSONFilterNestedNodeOutButton";

interface LogsJsonSceneState extends SceneObjectState {
  menu?: PanelMenu;
  filterJson: 'All' | 'JSON';
  data?: PanelData;
}

export type NodeTypeLoc = 'String' | 'Boolean' | 'Number' | 'Custom' | 'Object' | 'Array';

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

    const value = getNestedProperty(lineField, accessors);
    // console.log('getValue', {value, keyPath, nodeType, lineField})
    return value;
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

  private addDrilldown = (keyPath: KeyPath) => {
    const getLineFilterKey = getJsonKey(keyPath)
    const lineFormatVar = getLineFormatVariable(this);
      if (getLineFilterKey) {
          addJsonParserFields(this, keyPath, true)
          lineFormatVar.changeValueTo(`| line_format "{{.${getLineFilterKey}}}"`)
      }else{
          // If we don't have a key, the filter is drilling "up" into the root, remove any line_format and all json parser fields with values
          lineFormatVar.changeValueTo(``)

          // @todo, but we need to add a value for nested value filters, so we need to do better then removing all, just any associated with a drilldown.
          // @todo maybe the VAR_LINE_FORMAT needs to be an ad-hoc variable? Or we need to keep track of the key used in the drilldown somewhere, and only clear the json fields that matches
          removeJsonDrilldownFilters(this)
      }
  }

  private addFilter = (keyPath: KeyPath, filter: AdHocVariableFilter, nodeType: NodeTypeLoc, dataFrame: DataFrame | undefined) => {
    console.log('addFilter', { filter, nodeType, keyPath });
    let key = filter.key
    // @todo labels in JSON do not match labels from Loki
    if(key.includes('-')){
        key = key.replace(/-/g, '_');
    }

    // Add json parser value if nested
      if(keyPath.length > 4){
          addJsonParserFields(this, keyPath, true)
      }else{
          addJsonParserFields(this, keyPath, false)
      }

      // Top level fields are already extracted by initial json parser, no need to add them, until they drill in, or filter something else?



    const logsListScene = sceneGraph.getAncestor(this, LogsListScene);
    const variableType = getVariableForLabel(dataFrame, filter.key, this);

    // @todo force json parser for nested nodes
    // @todo check if filter already exists, toggle if same operator exists for same key, include/exclude otherwise
    addToFilters(key, filter.value, filter.operator === '=' ? 'include' : 'exclude', logsListScene, variableType)
  }

  private getKeyPathString(keyPath: KeyPath) {
    return keyPath[0] !== 'Time' ? keyPath[0] + ':' : keyPath[0];
  }

  public static Component = ({ model }: SceneComponentProps<LogsJsonScene>) => {
    // const styles = getStyles(grafanaTheme)
    const { menu, data } = model.useState();
    const $data = sceneGraph.getData(model);
    const {} = $data.useState();
    const logsListScene = sceneGraph.getAncestor(model, LogsListScene);
    const { visualizationType } = logsListScene.useState();
    const styles = useStyles2(getStyles);
    const lineFormatVar = getLineFormatVariable(model)

    const isDrillDown = !!lineFormatVar.state.value

    const dataFrame = getLogsPanelFrame(data);
    const lineField = dataFrame?.fields.find(
      (field) => field.type === FieldType.string && (field.name === 'Line' || field.name === 'body')
    );

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
            <LogsPanelHeaderActions vizType={visualizationType} onChange={logsListScene.setVisualizationType} />
          </>
        }
      >
        {!lineField?.values && (
          <>
            <LoadingPlaceholder text={'Loading...'} />
          </>
        )}

        {dataFrame && lineField?.values && (
          <span className={styles.JSONTreeWrap}>
            <JSONTree
              data={lineField.values}
              getItemString={(nodeType, data, itemType, itemString) => {
                // console.log('getItemString', { nodeType, data, itemType, itemString });
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
                const depth = keyPath.length;
                const nodeTypeLoc = nodeType as NodeTypeLoc;

                // console.log('labelRenderer', {
                //     depth, nodeTypeLoc, keyPath, expanded
                // })

                  if(keyPath[0] === 'root' && isDrillDown) {
                    return model.getNestedNodeDrilldownButtons(keyPath, nodeTypeLoc, dataFrame)
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
                  return model.getValueLabel(keyPath, nodeTypeLoc, lineField, dataFrame);
                }

                // Parent nodes
                if (
                  (nodeTypeLoc === 'Object' || nodeTypeLoc === 'Array') &&
                  keyPath[0] !== 'Line' &&
                  keyPath[0] !== 'root' &&
                  !isNumber(keyPath[0])
                ) {
                  if(depth <= 4) {
                    return model.getNestedNodeFilterButtons(keyPath, nodeTypeLoc, dataFrame);
                  }else {
                    return model.getNestedNodeDrilldownButtons(keyPath, nodeTypeLoc, dataFrame)
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

  private getNestedNodeDrilldownButtons(keyPath: KeyPath, nodeTypeLoc: NodeTypeLoc, dataFrame: DataFrame){
    //@todo move to static method or new component?
    // This is not a class component, this rule is wrong with scenes
    // eslint-disable-next-line react-hooks/rules-of-hooks

    const styles = useStyles2(getStyles);

    //@todo add already selected state
    return (
        <>
            <span className={styles.labelWrap}>
                <DrilldownButton keyPath={keyPath} addDrilldown={this.addDrilldown} />
                <strong>{this.getKeyPathString(keyPath)}</strong>
            </span>
        </>
    );
  }

  private getNestedNodeFilterButtons(keyPath: KeyPath, nodeTypeLoc: NodeTypeLoc, dataFrame: DataFrame) {
    //@todo move to static method or new component?
    // This is not a class component, this rule is wrong with scenes
    // eslint-disable-next-line react-hooks/rules-of-hooks

    //@todo add already selected state
    const styles = useStyles2(getStyles);
    return (
      <>
        <span className={styles.labelWrap}>
            <DrilldownButton keyPath={keyPath} addDrilldown={this.addDrilldown} />
            <JSONFilterNestedNodeInButton addFilter={this.addFilter} keyPath={keyPath} nodeTypeLoc={nodeTypeLoc} dataFrame={dataFrame}  />
            <JSONFilterNestedNodeOutButton addFilter={this.addFilter} keyPath={keyPath} nodeTypeLoc={nodeTypeLoc} dataFrame={dataFrame}  />
            <strong>{this.getKeyPathString(keyPath)}</strong>
        </span>
      </>
    );
  }

  private getValueLabel(
    keyPath: KeyPath,
    nodeTypeLoc: NodeTypeLoc,
    lineField: Field<string | number>,
    dataFrame: DataFrame
  ) {
    // This is not a class component, this rule is wrong with scenes
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const styles = useStyles2(getStyles);
    const value = this.getValue(keyPath, nodeTypeLoc, lineField.values)?.toString()
    // @todo add already selected state
    return (
      <>
        <span className={styles.labelButtonsWrap}>
          <IconButton
            tooltip={`Include log lines containing ${value}`}
            className={styles.filterButton}
            onClick={(e) => {
                e.stopPropagation();
              this.addFilter(
                  keyPath,
                {
                  key: getJsonKey(keyPath),
                  value,
                  operator: FilterOp.Equal,
                },
                nodeTypeLoc,
                dataFrame
              );
            }}
            size={'md'}
            name={'plus-circle'}
            aria-label={'add filter'}
          />
          <IconButton
            tooltip={`Exclude log lines containing ${value}`}
            className={styles.filterButton}
            onClick={(e) => {
                e.stopPropagation();
              this.addFilter(
                  keyPath,
                {
                  key: getJsonKey(keyPath),
                  value: this.getValue(keyPath, nodeTypeLoc, lineField.values).toString(),
                  operator: FilterOp.NotEqual,
                },
                nodeTypeLoc,
                dataFrame
              );
            }}
            size={'md'}
            name={'minus-circle'}
            aria-label={'remove filter'}
          />

          <strong className={styles.labelWrap}>{this.getKeyPathString(keyPath)}</strong>
        </span>
      </>
    );
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

    const fieldsVariable = getFieldsVariable(this);
    this._subs.add(
      // Hacky sync on field filter updates, this will result in duplicate queries
      fieldsVariable.subscribeToEvent(SceneVariableValueChangedEvent, (evt) => {
        console.log('fields changed event', evt)
        const state = evt.payload.state as AdHocFiltersVariable['state'];
        const fieldFilters = state.filters;


        const jsonVariable = getJsonFieldsVariable(this);
        let newJsonFilters: AdHocFilterWithLabels[] = [];

        jsonVariable.state.filters.forEach((jsonField) => {
          if (fieldFilters.find((fieldFilter) => fieldFilter.key === jsonField.key)) {
            newJsonFilters.push(jsonField);
          }
        });

        console.log('need to remove dups', newJsonFilters)
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
