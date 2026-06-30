import React from 'react';

import { DataFrame, LoadingState } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneDataProvider,
  SceneDataTransformer,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VariableValueOption,
  VizPanel,
} from '@grafana/scenes';
import { DrawStyle, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';

import { ValueSlugs } from '../../../services/enums';
import { buildLabelsQuery, LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS } from '../../../services/labels';
import { getQueryRunner, setLevelColorOverrides } from '../../../services/panel';
import { getLabelsPanelType } from '../../../services/store';
import { getFieldsVariable, getLabelGroupByVariable } from '../../../services/variableGetters';
import { ALL_VARIABLE_VALUE, LEVEL_VARIABLE_VALUE } from '../../../services/variables';
import { getPanelWrapperStyles, PanelMenu } from '../../Panels/PanelMenu';
import { ServiceScene } from '../ServiceScene';
import { FieldsPanelsType } from './FieldsAggregatedBreakdownScene';
import { LabelBreakdownScene } from './LabelBreakdownScene';
import { LayoutSwitcher } from './LayoutSwitcher';
import { SelectLabelActionScene } from './SelectLabelActionScene';
import { ShowLabelDisplayToggle } from './ShowLabelDisplayToggle';
import { MAX_NUMBER_OF_TIME_SERIES } from './TimeSeriesLimit';
import { cancelInFlightQueries } from 'services/queries';

export interface LabelsAggregatedBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher;
  labelsPanelsType: FieldsPanelsType;
}

export class LabelsAggregatedBreakdownScene extends SceneObjectBase<LabelsAggregatedBreakdownSceneState> {
  constructor(state: Partial<LabelsAggregatedBreakdownSceneState>) {
    super({
      labelsPanelsType: getLabelsPanelType() ?? 'timeseries',
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    const fields = getFieldsVariable(this);
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const $detectedLabels = serviceScene.state.$detectedLabelsData;

    // If the body hasn't been built yet, build it
    if (!this.state.body) {
      this.setState({
        body: this.build(),
      });
    }
    // Otherwise if we have the detected labels done loading, update the body
    else if ($detectedLabels?.state.data?.state === LoadingState.Done) {
      this.update($detectedLabels?.state.data.series[0]);
    }

    this._subs.add(
      $detectedLabels?.subscribeToState((newState, prevState) => {
        if (newState.data?.state === LoadingState.Done) {
          this.update(newState.data.series[0]);
        }
      })
    );

    this._subs.add(
      fields.subscribeToState(() => {
        this.updateQueriesOnFieldsVariableChange();
      })
    );

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.labelsPanelsType !== prevState.labelsPanelsType) {
          // Cancel any in-flight queries on the current (about to be discarded) body, otherwise
          // the time series requests keep running even after we switch to the text display.
          if (this.state.body) {
            cancelInFlightQueries(this.state.body);
          }
          // All query runners need to be rebuilt
          this.setState({
            body: this.build(),
          });
        }
      })
    );
  }

  private updateQueriesOnFieldsVariableChange = () => {
    // Text panels don't run volume queries, so there's nothing to update.
    if (this.state.labelsPanelsType === 'text') {
      return;
    }
    this.state.body?.state.layouts.forEach((layoutObj) => {
      const layout = layoutObj as SceneCSSGridLayout;
      // Iterate through the existing panels
      for (let i = 0; i < layout.state.children.length; i++) {
        const { panel, title } = this.getPanelByIndex(layout, i);
        const queryRunner: SceneDataProvider | SceneQueryRunner | undefined = panel.state.$data;
        const query = buildLabelsQuery(this, title, title);

        // Don't update if query didn't change
        if (queryRunner instanceof SceneQueryRunner) {
          if (query.expr === queryRunner?.state.queries?.[0]?.expr) {
            break;
          }
        }

        panel.setState({
          $data: getQueryRunner([query]),
        });
      }
    });
  };

  private getPanelByIndex(layout: SceneCSSGridLayout, i: number) {
    const gridItem = layout.state.children[i] as SceneCSSGridItem;
    const panel = gridItem.state.body as VizPanel;

    const title = panel.state.title;
    return { panel, title };
  }

  private update(detectedLabelsFrame: DataFrame) {
    const variable = getLabelGroupByVariable(this);
    const newLabels = variable.state.options.filter((opt) => opt.value !== ALL_VARIABLE_VALUE).map((opt) => opt.label);

    this.state.body?.state.layouts.forEach((layoutObj) => {
      let existingLabels = [];
      const layout = layoutObj as SceneCSSGridLayout;
      const newLabelsSet = new Set<string>(newLabels);
      const updatedChildren = layout.state.children as SceneCSSGridItem[];

      for (let i = 0; i < updatedChildren.length; i++) {
        const { title } = this.getPanelByIndex(layout, i);

        if (newLabelsSet.has(title)) {
          // If the new response has this field, delete it from the set, but leave it in the layout
          newLabelsSet.delete(title);
        } else {
          // Otherwise if the panel doesn't exist in the response, delete it from the layout
          updatedChildren.splice(i, 1);
          // And make sure to update the index, or we'll skip the next one
          i--;
        }
        existingLabels.push(title);
      }

      const labelsToAdd = Array.from(newLabelsSet);

      const options = labelsToAdd.map((fieldName) => {
        return {
          label: fieldName,
          value: fieldName,
        };
      });

      updatedChildren.push(...this.buildChildren(options));

      updatedChildren.sort(this.sortChildren());

      layout.setState({
        children: updatedChildren,
      });
    });
  }

  private build(): LayoutSwitcher {
    const variable = getLabelGroupByVariable(this);
    const labelBreakdownScene = sceneGraph.getAncestor(this, LabelBreakdownScene);
    labelBreakdownScene.state.search.reset();

    const children = this.buildChildren(variable.state.options);

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const $detectedLabels = serviceScene.state.$detectedLabelsData;
    if ($detectedLabels?.state.data?.state === LoadingState.Done) {
      children.sort(this.sortChildren());
    }

    const childrenClones = children.map((child) => child.clone());

    const isText = this.state.labelsPanelsType === 'text';

    return new LayoutSwitcher({
      // Text panels only support the grid view, so lock it and ignore the stored layout preference.
      active: 'grid',
      syncLayoutFromStore: !isText,
      layouts: [
        new SceneCSSGridLayout({
          autoRows: isText ? '35px' : '200px',
          children: children,
          isLazy: true,
          templateColumns: LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
        }),
        new SceneCSSGridLayout({
          autoRows: isText ? '35px' : '200px',
          children: childrenClones,
          isLazy: true,
          templateColumns: '1fr',
        }),
      ],
      options: [
        {
          label: t('components.service-scene.breakdowns.labels-aggregated-breakdown-scene.layout.grid', 'Grid'),
          value: 'grid',
        },
        {
          label: t('components.service-scene.breakdowns.labels-aggregated-breakdown-scene.layout.rows', 'Rows'),
          value: 'rows',
        },
      ],
    });
  }

  private buildChildren(options: VariableValueOption[]) {
    const children: SceneCSSGridItem[] = [];
    for (const option of options) {
      const { value } = option;
      const optionValue = String(value);
      if (value === ALL_VARIABLE_VALUE || !value) {
        continue;
      }
      children.push(
        this.state.labelsPanelsType === 'text'
          ? this.buildTextChild(optionValue)
          : this.buildTimeSeriesChild(optionValue)
      );
    }
    return children;
  }

  private buildTimeSeriesChild(optionValue: string): SceneCSSGridItem {
    const query = buildLabelsQuery(this, optionValue, optionValue);
    const queryRunner = getQueryRunner([query]);

    return new SceneCSSGridItem({
      body: PanelBuilders.timeseries()
        .setOption('annotations', { multiLane: true })
        .setTitle(optionValue)
        .setData(queryRunner)
        .setHeaderActions([new SelectLabelActionScene({ fieldType: ValueSlugs.label, labelName: optionValue })])
        .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
        .setCustomFieldConfig('fillOpacity', 100)
        .setCustomFieldConfig('lineWidth', 0)
        .setCustomFieldConfig('pointSize', 0)
        .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
        .setHoverHeader(false)
        .setShowMenuAlways(true)
        .setOverrides(setLevelColorOverrides)
        .setMenu(new PanelMenu({}))
        .setSeriesLimit(MAX_NUMBER_OF_TIME_SERIES)
        .build(),
    });
  }

  private buildTextChild(optionValue: string): SceneCSSGridItem {
    const text = PanelBuilders.text()
      .setTitle(optionValue)
      // Text panels don't query volume; an empty data provider keeps the panel lightweight.
      .setData(new SceneDataTransformer({ transformations: [] }))
      .setHeaderActions([new SelectLabelActionScene({ fieldType: ValueSlugs.label, labelName: optionValue })])
      .setShowMenuAlways(true)
      .setMenu(new PanelMenu({}));

    text.setOption('content', '');

    return new SceneCSSGridItem({
      body: text.build(),
    });
  }

  private sortChildren() {
    return (a: SceneCSSGridItem, b: SceneCSSGridItem) => {
      const aPanel = a.state.body as VizPanel;
      const bPanel = b.state.body as VizPanel;
      if (aPanel.state.title === LEVEL_VARIABLE_VALUE) {
        return -1;
      }
      if (bPanel.state.title === LEVEL_VARIABLE_VALUE) {
        return 1;
      }
      return aPanel.state.title.toLowerCase().localeCompare(bPanel.state.title.toLowerCase());
    };
  }

  public static ShowLabelDisplayToggle = ShowLabelDisplayToggle;

  public static Selector({ model }: SceneComponentProps<LabelsAggregatedBreakdownScene>) {
    const { body } = model.useState();
    return <>{body && <LayoutSwitcher.Selector model={body} />}</>;
  }

  public static Component = ({ model }: SceneComponentProps<LabelsAggregatedBreakdownScene>) => {
    const { body } = model.useState();
    const styles = useStyles2(getPanelWrapperStyles);

    if (body) {
      return <div className={styles.panelWrapper}>{body && <body.Component model={body} />}</div>;
    }

    return (
      <LoadingPlaceholder
        text={t('components.service-scene.breakdowns.labels-aggregated-breakdown-scene.loading', 'Loading...')}
      />
    );
  };
}
