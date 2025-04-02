import {
  PanelBuilders,
  QueryRunnerState,
  SceneByFrameRepeater,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneDataTransformer,
  SceneFlexItem,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
  VizPanel,
} from '@grafana/scenes';
import {
  ALL_VARIABLE_VALUE,
  DetectedFieldType,
  ParserType,
  VARIANT_EXPR,
  VARIANT_PLACEHOLDER
} from '../../../services/variables';
import {buildDataQuery} from '../../../services/query';
import {getQueryRunner, getSceneQueryRunner, setLevelColorOverrides} from '../../../services/panel';
import {DrawStyle, LoadingPlaceholder, StackingMode, useStyles2} from '@grafana/ui';
import {LayoutSwitcher} from './LayoutSwitcher';
import {FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS, FieldsBreakdownScene} from './FieldsBreakdownScene';
import {
  getDetectedFieldsFrame,
  getDetectedFieldsFrameFromQueryRunnerState,
  getDetectedFieldsNamesFromQueryRunnerState,
  getDetectedFieldsParsersFromQueryRunnerState,
  ServiceScene,
} from '../ServiceScene';
import React from 'react';
import {SelectLabelActionScene} from './SelectLabelActionScene';
import {ValueSlugs} from '../../../services/routing';
import {DataFrame, LoadingState, PanelData} from '@grafana/data';
import {
  buildFieldsQueryString,
  extractParserFromArray,
  getDetectedFieldType,
  getVariantAndLabel,
  groupFramesByVariantTransformation,
  isAvgField, selectFramesTransformation, selectFrameTransformation,
} from '../../../services/fields';
import {getFieldGroupByVariable, getFieldsVariable, getValueFromFieldsFilter,} from '../../../services/variableGetters';
import {AvgFieldPanelType, getPanelWrapperStyles, PanelMenu} from '../../Panels/PanelMenu';
import {logger} from '../../../services/logger';
import {getPanelOption} from '../../../services/store';
import {MAX_NUMBER_OF_TIME_SERIES} from './TimeSeriesLimit';
import {LokiQuery} from "../../../services/lokiQuery";

export interface FieldsAggregatedBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher;
}

export class FieldsAggregatedBreakdownScene extends SceneObjectBase<FieldsAggregatedBreakdownSceneState> {
  constructor(state: Partial<FieldsAggregatedBreakdownSceneState>) {
    super(state);

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
                  const dataTransformer = this.getQueryRunnerForPanel(
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
      // $data: getQueryRunner()
    });

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    if (serviceScene.state.fieldsCount === undefined) {
      this.updateFieldCount();
    }

    this._subs.add(serviceScene.state.$detectedFieldsData?.subscribeToState(this.onDetectedFieldsChange));
    this._subs.add(this.subscribeToFieldsVar());
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
    this.buildChildrenQueries(options);

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const cardinalityMap = this.calculateCardinalityMap(serviceScene.state.$detectedFieldsData?.state);
    children.sort(this.sortChildren(cardinalityMap));
    const childrenClones = children.map((child) => child.clone());

    // We must subscribe to the data providers for all children after the clone, or we'll see bugs in the row layout
    [...children, ...childrenClones].map((child) => {
      this.subscribeToPanel(child);
    });

    return new LayoutSwitcher({
      options: [
        { value: 'grid', label: 'Grid' },
        { value: 'rows', label: 'Rows' },
        {value: 'single', label: 'Single'}
      ],
      active: 'grid',
      layouts: [
        new SceneCSSGridLayout({
          templateColumns: FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
          autoRows: '200px',
          children: children,
          isLazy: true,
        }),
        new SceneCSSGridLayout({
          templateColumns: '1fr',
          autoRows: '200px',
          children: childrenClones,
          isLazy: true,
        }),
        // new SceneFlexLayout({
        //   children: [
        //       new SceneFlexItem({
        //         body: PanelBuilders.timeseries().setData(this.state.$data).build()
        //       })
        //   ]
        // })
          new SceneByFrameRepeater({
            $data: new SceneDataTransformer({
              transformations: [() => groupFramesByVariantTransformation(this.state.$data?.state.data?.series)],
            }),
            getLayoutChild(data: PanelData, frames: DataFrame[], frameIndex: number): SceneObject {
              console.log('getLayoutChild', {
                data, frames
              })
              const {labelName, variant} = getVariantAndLabel(frames[0])
              const panel = PanelBuilders.timeseries()
                  .setTitle(`${labelName} - ${variant}`)
                  .setData(new SceneDataTransformer({
                    transformations: [() => selectFramesTransformation(frames, frameIndex)],
                  }),)
                  .setOption('legend', { showLegend: false })
                  .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                  .setCustomFieldConfig('fillOpacity', 100)
                  .setCustomFieldConfig('lineWidth', 0)
                  .setCustomFieldConfig('pointSize', 0)
                  .setCustomFieldConfig('drawStyle', DrawStyle.Bars)

                  return new SceneCSSGridItem({
                    body: panel.build(),
                  });
            },
            body: new SceneCSSGridLayout({
              templateColumns: FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
              autoRows: '200px',
              children: [
                new SceneFlexItem({
                  body: new SceneReactObject({
                    reactNode: <LoadingPlaceholder text="Loading..." />,
                  }),
                }),
              ],
              isLazy: true,
            }),
          })
      ],
    });
  }

  private subscribeToPanel(child: SceneCSSGridItem) {
    const panel = child.state.body as VizPanel | undefined;
    if (panel) {
      this._subs.add(
        panel?.state.$data?.getResultsStream().subscribe((result) => {
          if (result.data.errors && result.data.errors.length > 0) {
            child.setState({ isHidden: true });
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
      if (child instanceof SceneCSSGridItem && !child.state.isHidden) {
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

  private buildChildrenQueries(options: string[]) {
    const childrenQueries: LokiQuery[] = []
    const detectedFieldsFrame = getDetectedFieldsFrame(this);

    for (const option of options) {
      if (option === ALL_VARIABLE_VALUE || !option) {
        continue;
      }

      const fieldType = getDetectedFieldType(option, detectedFieldsFrame);
      const query = this.getLokiQueryForPanel(option, detectedFieldsFrame, fieldType, '__variant__')
      childrenQueries.push(query)
    }
    const variantExpr = VARIANT_EXPR.replace(VARIANT_PLACEHOLDER, childrenQueries.map(query => query.expr).join(',\n\t'))
    const legendFormats = childrenQueries.map(query => query.legendFormat).join("")


    console.log('children queries', childrenQueries)
    console.log('variant query', VARIANT_EXPR)
    console.log('variant expr', variantExpr)
    console.log('variant interpolated:', {
      interpolated: sceneGraph.interpolate(this, variantExpr)
    })

    const dataQuery = buildDataQuery(variantExpr, {
      legendFormat: legendFormats,
      refId: 'fields-variant',
    });

    this.setState({
      $data: getSceneQueryRunner({
        queries: [dataQuery],
      })
    })
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
        child.addActivationHandler(() => {
          console.log('child activation', child)
        })
      }
    }


    return children;
  }

  private buildChild(labelName: string, detectedFieldsFrame: DataFrame | undefined, panelType?: AvgFieldPanelType) {
    if (labelName === ALL_VARIABLE_VALUE || !labelName) {
      return;
    }

    const fieldType = getDetectedFieldType(labelName, detectedFieldsFrame);
    const dataTransformer = this.getQueryRunnerForPanel(labelName, detectedFieldsFrame, fieldType);
    let body;
    const headerActions = [];
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
      headerActions.push(new SelectLabelActionScene({ labelName: String(labelName), fieldType: ValueSlugs.field }));
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
          labelName: String(labelName),
          hideValueDrilldown: true,
          fieldType: ValueSlugs.field,
        })
      );
    }
    body.setHeaderActions(headerActions);
    body.setSeriesLimit(MAX_NUMBER_OF_TIME_SERIES);
    // 11.5
    // body.setShowMenuAlways(true);

    const viz = body.build();
    return new SceneCSSGridItem({
      body: viz,
    });
  }

  private getLokiQueryForPanel(
      optionValue: string,
      detectedFieldsFrame: DataFrame | undefined,
      fieldType?: DetectedFieldType,
      aggregation?: string
  ) {
    const fieldsVariable = getFieldsVariable(this);
    const queryString = buildFieldsQueryString(optionValue, fieldsVariable, detectedFieldsFrame, aggregation);
    return buildDataQuery(queryString, {
      legendFormat: isAvgField(fieldType) ? optionValue : `{{${optionValue}}}`,
      refId: optionValue,
    });
  }


  private getQueryRunnerForPanel(
    optionValue: string,
    detectedFieldsFrame: DataFrame | undefined,
    fieldType?: DetectedFieldType
  ) {
    const fieldsVariable = getFieldsVariable(this);
    const queryString = buildFieldsQueryString(optionValue, fieldsVariable, detectedFieldsFrame);
    const query = buildDataQuery(queryString, {
      legendFormat: isAvgField(fieldType) ? optionValue : `{{${optionValue}}}`,
      refId: optionValue,
    });

    return getQueryRunner([query]);
  }

  private getActiveGridLayouts() {
    return (this.state.body?.state.layouts.find((l) => l.isActive) ?? this.state.body?.state.layouts[0]) as
      | SceneCSSGridLayout
      | undefined;
  }

  private updateFieldCount() {
    const activeLayout = this.getActiveGridLayouts();
    const activeLayoutChildren = activeLayout?.state.children as SceneCSSGridItem[] | undefined;
    const activePanels = activeLayoutChildren?.filter((child) => !child.state.isHidden);

    const fieldsBreakdownScene = sceneGraph.getAncestor(this, FieldsBreakdownScene);
    fieldsBreakdownScene.state.changeFieldCount?.(activePanels?.length ?? 0);
  }

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
