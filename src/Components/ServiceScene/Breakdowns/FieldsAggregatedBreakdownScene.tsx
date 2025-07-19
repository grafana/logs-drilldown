import React from 'react';

import { map, Observable } from 'rxjs';

import {
  DataFrame,
  DataTransformContext,
  FieldConfig,
  FieldType,
  LoadingState,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';
import {
  PanelBuilders,
  QueryRunnerState,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneDataProvider,
  SceneDataTransformer,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
  VizPanelBuilder,
} from '@grafana/scenes';
import { Options as BarGaugeOptions } from '@grafana/schema/dist/esm/raw/composable/gauge/panelcfg/x/GaugePanelCfg_types.gen';
import {
  FieldConfig as TimeSeriesFieldConfig,
  Options as TimeSeriesOptions,
} from '@grafana/schema/dist/esm/raw/composable/timeseries/panelcfg/x/TimeSeriesPanelCfg_types.gen';
import { DrawStyle, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../../services/analytics';
import { ValueSlugs } from '../../../services/enums';
import {
  buildFieldsQueryString,
  calculateSparsity,
  extractParserFromArray,
  getDetectedFieldType,
  isAvgField,
  SparsityCalculation,
} from '../../../services/fields';
import { logger } from '../../../services/logger';
import {
  getQueryRunner,
  getSceneQueryRunner,
  setGaugeUnitOverrides,
  setLevelColorOverrides,
} from '../../../services/panel';
import { buildDataQuery } from '../../../services/query';
import { getPanelOption, getShowErrorPanels, setShowErrorPanels } from '../../../services/store';
import {
  getFieldGroupByVariable,
  getFieldsVariable,
  getJsonFieldsVariable,
  getValueFromFieldsFilter,
} from '../../../services/variableGetters';
import { ALL_VARIABLE_VALUE, DetectedFieldType, ParserType } from '../../../services/variables';
import { AvgFieldPanelType, getPanelWrapperStyles, PanelMenu } from '../../Panels/PanelMenu';
import {
  getDetectedFieldsFrame,
  getDetectedFieldsFrameFromQueryRunnerState,
  getDetectedFieldsNamesFromQueryRunnerState,
  getDetectedFieldsParsersFromQueryRunnerState,
  ServiceScene,
} from '../ServiceScene';
import { FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS, FieldsBreakdownScene } from './FieldsBreakdownScene';
import { LayoutSwitcher } from './LayoutSwitcher';
import { SelectLabelActionScene } from './SelectLabelActionScene';
import { ShowErrorPanelToggle } from './ShowErrorPanelToggle';
import { ShowFieldDisplayToggle } from './ShowFieldDisplayToggle';
import { MAX_NUMBER_OF_TIME_SERIES } from './TimeSeriesLimit';

export type FieldsPanelTypes = 'cardinality' | 'cardinality_estimated' | 'volume';

export interface FieldsAggregatedBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher;
  panelType: FieldsPanelTypes;
  showErrorPanels: boolean;
  showErrorPanelToggle: boolean;
}

export class FieldsAggregatedBreakdownScene extends SceneObjectBase<FieldsAggregatedBreakdownSceneState> {
  constructor(state: Partial<FieldsAggregatedBreakdownSceneState>) {
    super({
      panelType: 'volume',
      showErrorPanels: getShowErrorPanels(),
      showErrorPanelToggle: false,
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onDetectedFieldsChange = (newState: QueryRunnerState) => {
    if (newState.data?.state === LoadingState.Done) {
      //@todo cardinality looks wrong in API response
      this.updateChildren(newState);
    }
  };

  private updateChildren(newState: QueryRunnerState, newParser: ParserType | undefined = undefined) {
    const detectedFieldsFrame = getDetectedFieldsFrameFromQueryRunnerState(newState);
    const newNamesField = getDetectedFieldsNamesFromQueryRunnerState(newState);
    const newParsersField = getDetectedFieldsParsersFromQueryRunnerState(newState);
    const cardinalityMap = this.calculateCardinalityMap(newState);

    // Iterate through all the layouts
    this.state.body?.state.layouts.forEach((layout) => {
      if (layout instanceof SceneCSSGridLayout) {
        // populate set of new list of fields
        const newFieldsSet = new Set<string>(newNamesField?.values);
        const updatedChildren = layout.state.children as SceneCSSGridItem[];

        // Iterate through all the existing panels
        for (let i = 0; i < updatedChildren.length; i++) {
          const gridItem = layout.state.children[i];
          if (gridItem instanceof SceneCSSGridItem) {
            const panel = gridItem.state.body;
            if (panel instanceof VizPanel) {
              if (newParser) {
                const index = newNamesField?.values.indexOf(panel.state.title);
                const existingParser = index && index !== -1 ? newParsersField?.values[index] : undefined;

                // If a new field filter was added that updated the parsers, we'll need to rebuild the query
                if (existingParser !== newParser) {
                  const fieldType = getDetectedFieldType(panel.state.title, detectedFieldsFrame);
                  const dataTransformer = this.getTimeSeriesQueryRunnerForPanel(
                    panel.state.title,
                    detectedFieldsFrame,
                    fieldType
                  );
                  panel.setState({
                    $data: dataTransformer,
                  });
                }
              }

              if (newFieldsSet.has(panel.state.title)) {
                // If the new response has this field, delete it from the set, but leave it in the layout
                newFieldsSet.delete(panel.state.title);
              } else {
                // Otherwise if the panel doesn't exist in the response, delete it from the layout
                updatedChildren.splice(i, 1);
                // And make sure to update the index, or we'll skip the next one
                i--;
              }
            } else {
              logger.warn('panel is not VizPanel!');
            }
          } else {
            logger.warn('gridItem is not SceneCSSGridItem');
          }
        }

        const fieldsToAdd = Array.from(newFieldsSet);
        const options = fieldsToAdd.map((fieldName) => fieldName);

        updatedChildren.push(...this.buildChildren(options));
        updatedChildren.sort(this.sortChildren(cardinalityMap));

        updatedChildren.map((child) => {
          this.subscribeToPanel(child);
        });

        layout.setState({
          children: updatedChildren,
        });
      } else {
        logger.warn('Layout is not SceneCSSGridLayout');
      }
    });
  }

  private sortChildren(cardinalityMap: Map<string, number>) {
    return (a: SceneCSSGridItem, b: SceneCSSGridItem) => {
      const aPanel = a.state.body as VizPanel;
      const bPanel = b.state.body as VizPanel;
      const aCardinality = cardinalityMap.get(aPanel.state.title) ?? 0;
      const bCardinality = cardinalityMap.get(bPanel.state.title) ?? 0;
      return bCardinality - aCardinality;
    };
  }

  private calculateCardinalityMap(newState?: QueryRunnerState) {
    const detectedFieldsFrame = getDetectedFieldsFrameFromQueryRunnerState(newState);
    const cardinalityMap = new Map<string, number>();
    if (detectedFieldsFrame?.length) {
      for (let i = 0; i < detectedFieldsFrame?.length; i++) {
        const name: string = detectedFieldsFrame.fields[0].values[i];
        const cardinality: number = detectedFieldsFrame.fields[1].values[i];
        cardinalityMap.set(name, cardinality);
      }
    }
    return cardinalityMap;
  }

  onActivate() {
    this.setState({
      body: this.build(),
    });

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    if (serviceScene.state.fieldsCount === undefined) {
      this.updateFieldCount();
    }

    this._subs.add(serviceScene.state.$detectedFieldsData?.subscribeToState(this.onDetectedFieldsChange));
    this._subs.add(this.subscribeToFieldsVar());
    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.panelType !== prevState.panelType) {
          // All query runners need to be rebuilt
          this.setState({
            body: this.build(),
          });
        }
      })
    );
  }

  private subscribeToFieldsVar() {
    const fieldsVar = getFieldsVariable(this);

    return fieldsVar.subscribeToState((newState, prevState) => {
      const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
      const newParsers = newState.filters.map((f) => getValueFromFieldsFilter(f).parser);
      const oldParsers = prevState.filters.map((f) => getValueFromFieldsFilter(f).parser);

      const newParser = extractParserFromArray(newParsers);
      const oldParser = extractParserFromArray(oldParsers);

      if (newParser !== oldParser) {
        const detectedFieldsState = serviceScene.state.$detectedFieldsData?.state;
        if (detectedFieldsState) {
          this.updateChildren(detectedFieldsState, newParser);
        }
      }
    });
  }

  public build() {
    const groupByVariable = getFieldGroupByVariable(this);
    const options = groupByVariable.state.options.map((opt) => String(opt.value));

    const fieldsBreakdownScene = sceneGraph.getAncestor(this, FieldsBreakdownScene);
    fieldsBreakdownScene.state.search.reset();

    const children = this.buildChildren(options);

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const cardinalityMap = this.calculateCardinalityMap(serviceScene.state.$detectedFieldsData?.state);
    children.sort(this.sortChildren(cardinalityMap));
    const childrenClones = children.map((child) => child.clone());

    // We must subscribe to the data providers for all children after the clone, or we'll see bugs in the row layout
    [...children, ...childrenClones].map((child) => {
      this.subscribeToPanel(child);
    });

    return new LayoutSwitcher({
      active: 'grid',
      layouts: [
        new SceneCSSGridLayout({
          autoRows: '200px',
          children: children,
          isLazy: true,
          templateColumns: FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
        }),
        new SceneCSSGridLayout({
          autoRows: '200px',
          children: childrenClones,
          isLazy: true,
          templateColumns: '1fr',
        }),
      ],
      options: [
        { label: 'Grid', value: 'grid' },
        { label: 'Rows', value: 'rows' },
      ],
    });
  }

  private subscribeToPanel(child: SceneCSSGridItem) {
    const panel = child.state.body;
    if (panel && panel instanceof VizPanel) {
      this._subs.add(
        panel?.state.$data?.getResultsStream().subscribe((result) => {
          if (result.data.errors && result.data.errors.length > 0) {
            if (!this.state.showErrorPanels) {
              child.setState({ isHidden: true });
            } else {
              child.setState({ isHidden: false });
            }

            if (!this.state.showErrorPanelToggle) {
              this.setState({ showErrorPanelToggle: true });
            }
            this.updateFieldCount();
          }
        })
      );
    }
  }

  public rebuildAvgFields() {
    const detectedFieldsFrame = getDetectedFieldsFrame(this);
    const activeLayout = this.getActiveGridLayouts();
    const children: SceneCSSGridItem[] = [];
    const panelType =
      getPanelOption('panelType', [AvgFieldPanelType.histogram, AvgFieldPanelType.timeseries]) ??
      AvgFieldPanelType.timeseries;

    activeLayout?.state.children.forEach((child) => {
      if (
        (child instanceof SceneCSSGridItem && this.state.showErrorPanels) ||
        (child instanceof SceneCSSGridItem && !child.state.isHidden)
      ) {
        const panels = sceneGraph.findDescendents(child, VizPanel);
        if (panels.length) {
          // Will only be one panel as a child of CSSGridItem
          const panel = panels[0];
          const labelName = panel.state.title;
          const fieldType = getDetectedFieldType(labelName, detectedFieldsFrame);
          if (isAvgField(fieldType)) {
            const newChild = this.buildChild(labelName, detectedFieldsFrame, panelType);
            if (newChild) {
              children.push(newChild);
            }
          } else {
            children.push(child);
          }
        }
      }
    });

    if (children.length) {
      activeLayout?.setState({
        children,
      });
    }
  }

  private buildChildren(options: string[]): SceneCSSGridItem[] {
    const children: SceneCSSGridItem[] = [];
    const detectedFieldsFrame = getDetectedFieldsFrame(this);
    const panelType =
      getPanelOption('panelType', [AvgFieldPanelType.timeseries, AvgFieldPanelType.histogram]) ??
      AvgFieldPanelType.timeseries;
    for (const option of options) {
      if (option === ALL_VARIABLE_VALUE || !option) {
        continue;
      }

      const child = this.buildChild(option, detectedFieldsFrame, panelType);
      if (child) {
        children.push(child);
      }
    }
    return children;
  }

  private buildChild(labelName: string, detectedFieldsFrame: DataFrame | undefined, panelType?: AvgFieldPanelType) {
    if (labelName === ALL_VARIABLE_VALUE || !labelName) {
      return;
    }

    const fieldType = getDetectedFieldType(labelName, detectedFieldsFrame);

    let body: VizPanelBuilder<BarGaugeOptions, FieldConfig> | VizPanelBuilder<TimeSeriesOptions, TimeSeriesFieldConfig>;
    if (this.state.panelType === 'volume') {
      const dataTransformer = this.getTimeSeriesQueryRunnerForPanel(labelName, detectedFieldsFrame, fieldType);
      body = this.buildTimeSeries(fieldType, labelName, dataTransformer, panelType);
      body.setSeriesLimit(MAX_NUMBER_OF_TIME_SERIES);
      body.setMenu(new PanelMenu({ investigationOptions: { labelName: labelName }, panelType }));
    } else if (this.state.panelType === 'cardinality_estimated') {
      const dataTransformer = this.getEstimatedCardinalityQueryRunnerForPanel(labelName, detectedFieldsFrame);
      body = this.buildGauge(labelName, fieldType, dataTransformer);
    } else {
      const queryRunner = this.getCardinalityQueryRunnerForPanel(labelName, detectedFieldsFrame);
      body = this.buildStat(labelName, fieldType, queryRunner);
      body.setMenu(new PanelMenu({ investigationOptions: { labelName: labelName }, panelType }));
    }

    body.setShowMenuAlways(true);

    const viz = body.build();
    return new SceneCSSGridItem({
      body: viz,
    });
  }

  private buildStat = (
    labelName: string,
    fieldType: DetectedFieldType | undefined,
    queryProvider: SceneDataProvider
  ) => {
    return PanelBuilders.stat()
      .setData(queryProvider)
      .setTitle(labelName)
      .setThresholds({
        mode: ThresholdsMode.Absolute,
        steps: [
          { color: '', value: 33 },
          { color: '', value: 66 },
          { color: '', value: 100 },
        ],
      })
      .setHeaderActions(
        new SelectLabelActionScene({
          description: `Count of unique values in ${labelName}`,
          fieldType: ValueSlugs.field,
          hasNumericFilters: fieldType === 'int',
          labelName: labelName,
        })
      );
  };

  private buildGauge = (
    labelName: string,
    fieldType: DetectedFieldType | undefined,
    queryProvider: SceneDataProvider
  ): VizPanelBuilder<BarGaugeOptions, FieldConfig> => {
    const gauge = PanelBuilders.gauge()
      .setMax(100)
      .setMin(1)
      .setThresholds({
        mode: ThresholdsMode.Percentage,
        steps: [
          { color: 'green', value: 33 },
          { color: 'yellow', value: 66 },
          { color: 'red', value: 100 },
        ],
      })
      .setData(queryProvider)
      .setTitle(labelName)
      .setHeaderActions(
        new SelectLabelActionScene({
          fieldType: ValueSlugs.field,
          hasNumericFilters: fieldType === 'int',
          labelName: String(labelName),
        })
      );

    gauge.setOverrides(setGaugeUnitOverrides);

    return gauge;
  };

  private buildTimeSeries = (
    fieldType: 'boolean' | 'bytes' | 'duration' | 'float' | 'int' | 'string' | undefined,
    labelName: string,
    dataTransformer: SceneDataTransformer | SceneQueryRunner,
    panelType: AvgFieldPanelType | undefined
  ): VizPanelBuilder<TimeSeriesOptions, TimeSeriesFieldConfig> => {
    let body;
    let headerActions = [];
    if (!isAvgField(fieldType)) {
      body = PanelBuilders.timeseries()
        .setTitle(labelName)
        .setData(dataTransformer)
        .setMenu(new PanelMenu({ investigationOptions: { labelName: labelName } }))
        .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
        .setCustomFieldConfig('fillOpacity', 100)
        .setCustomFieldConfig('lineWidth', 0)
        .setCustomFieldConfig('pointSize', 0)
        .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
        .setOverrides(setLevelColorOverrides);

      headerActions.push(
        new SelectLabelActionScene({
          fieldType: ValueSlugs.field,
          hasNumericFilters: fieldType === 'int',
          labelName: String(labelName),
        })
      );
    } else {
      if (panelType === 'histogram') {
        body = PanelBuilders.histogram();
      } else {
        body = PanelBuilders.timeseries();
      }
      body
        .setTitle(labelName)
        .setData(dataTransformer)
        .setMenu(new PanelMenu({ investigationOptions: { labelName: labelName }, panelType }));
      headerActions.push(
        new SelectLabelActionScene({
          fieldType: ValueSlugs.field,
          hideValueDrilldown: true,
          labelName: String(labelName),
        })
      );
    }
    body.setHeaderActions(headerActions);
    return body;
  };

  private getTimeSeriesQueryRunnerForPanel(
    optionValue: string,
    detectedFieldsFrame: DataFrame | undefined,
    fieldType?: DetectedFieldType
  ) {
    const fieldsVariable = getFieldsVariable(this);
    const jsonVariable = getJsonFieldsVariable(this);
    const queryString = buildFieldsQueryString(optionValue, fieldsVariable, detectedFieldsFrame, jsonVariable);
    const query = buildDataQuery(queryString, {
      legendFormat: isAvgField(fieldType) ? optionValue : `{{${optionValue}}}`,
      refId: optionValue,
    });

    return getQueryRunner([query]);
  }

  private getEstimatedCardinalityQueryRunnerForPanel(optionValue: string, detectedFieldsFrame: DataFrame | undefined) {
    // const cardinality = getEstimatedCardinality(optionValue, detectedFieldsFrame);
    const sparsity = calculateSparsity(this, optionValue);
    if (sparsity.cardinality) {
      return new SceneDataTransformer({
        transformations: [(ctx) => estimatedCardinality(ctx, sparsity)],
      });
    }

    return new SceneDataTransformer({
      transformations: [],
    });
  }

  private getCardinalityQueryRunnerForPanel(optionValue: string, detectedFieldsFrame: DataFrame | undefined) {
    const fieldsVariable = getFieldsVariable(this);
    const jsonVariable = getJsonFieldsVariable(this);
    const queryString = buildFieldsQueryString(optionValue, fieldsVariable, detectedFieldsFrame, jsonVariable);
    const query = buildDataQuery(queryString, {
      legendFormat: `{{${optionValue}}}`,
      queryType: 'instant',
      refId: `Instant - ${optionValue}`,
    });

    return new SceneDataTransformer({
      $data: getSceneQueryRunner({
        queries: [query],
      }),
      transformations: [instantQueryCardinality],
    });
  }

  private getActiveGridLayouts() {
    return (this.state.body?.state.layouts.find((l) => l.isActive) ?? this.state.body?.state.layouts[0]) as
      | SceneCSSGridLayout
      | undefined;
  }

  private updateFieldCount() {
    const activeLayout = this.getActiveGridLayouts();
    const activeLayoutChildren = activeLayout?.state.children as SceneCSSGridItem[] | undefined;
    const activePanels = activeLayoutChildren?.filter((child) => this.state.showErrorPanels || !child.state.isHidden);

    const fieldsBreakdownScene = sceneGraph.getAncestor(this, FieldsBreakdownScene);
    fieldsBreakdownScene.state.changeFieldCount?.(activePanels?.length ?? 0);
  }

  public toggleErrorPanels(event: React.ChangeEvent<HTMLInputElement>) {
    const showErrorPanels = event.target.checked;
    this.setState({ showErrorPanels });
    setShowErrorPanels(showErrorPanels);
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.toggle_error_panels, {
      checked: showErrorPanels,
    });
    // No need to re-run queries if we have the query runners in the panel with the error state.
    if (!showErrorPanels) {
      if (serviceScene.state.$detectedFieldsData?.state) {
        this.updateChildren(serviceScene.state.$detectedFieldsData?.state);
      } else {
        this.setState({
          body: this.build(),
        });
      }
      // But otherwise we need to re-run any query for panels we don't have query runners for.
      // @todo We could make this more efficient and only run queries on panels that are in the latest detected_fields response that don't have an associated panel
    } else {
      this.setState({
        body: this.build(),
      });
    }
  }

  public static ShowErrorPanelToggle = ShowErrorPanelToggle;

  public static ShowFieldDisplayToggle = ShowFieldDisplayToggle;

  public static Selector({ model }: SceneComponentProps<FieldsAggregatedBreakdownScene>) {
    const { body } = model.useState();
    return <>{body && <LayoutSwitcher.Selector model={body} />}</>;
  }

  public static Component = ({ model }: SceneComponentProps<FieldsAggregatedBreakdownScene>) => {
    const { body } = model.useState();
    const styles = useStyles2(getPanelWrapperStyles);
    if (body) {
      return <span className={styles.panelWrapper}>{body && <body.Component model={body} />}</span>;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };
}

export function instantQueryCardinality() {
  return (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map((frames) => {
        const resultFrames = [
          toDataFrame({
            fields: [
              {
                name: 'Cardinality',
                type: FieldType.number,
                values: [frames?.[0]?.fields?.[1].values.length ?? null],
              },
            ],
          }),
        ];

        return resultFrames;
      })
    );
  };
}

export const GAUGE_CARDINALITY_FIELD_NAME = 'Cardinality';
export const SPARSITY_CARDINALITY_FIELD_NAME = 'Frequency';

export function estimatedCardinality(ctx: DataTransformContext, sparsity: SparsityCalculation) {
  return (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map((frames) => {
        const resultFrames = [
          toDataFrame({
            fields: [
              {
                name: GAUGE_CARDINALITY_FIELD_NAME,
                type: FieldType.number,
                values: [sparsity.cardinality],
              },
              {
                name: SPARSITY_CARDINALITY_FIELD_NAME,
                type: FieldType.number,
                values: [sparsity.sparsity],
              },
            ],
          }),
        ];
        return resultFrames;
      })
    );
  };
}
