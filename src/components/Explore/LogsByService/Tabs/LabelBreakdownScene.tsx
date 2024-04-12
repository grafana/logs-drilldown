import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  AdHocFiltersVariable,
  CustomVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneFlexItem,
  SceneFlexItemLike,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneReactObject,
  SceneVariableSet,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Button, DrawStyle, Field, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';

import { BreakdownLabelSelector } from './BreakdownLabelSelector';
import { StatusWrapper } from '../../StatusWrapper';
import {
  ALL_VARIABLE_VALUE,
  explorationDS,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_FILTERS,
  VAR_LABEL_GROUP_BY,
} from '../../../../utils/shared';

import { AddToFiltersGraphAction } from '../../AddToFiltersGraphAction';
import { ByFrameRepeater } from '../../ByFrameRepeater';
import { LayoutSwitcher } from '../../LayoutSwitcher';
import { getDatasource, getLabelOptions } from '../../../../utils/utils';
import { getLayoutChild } from '../../../../utils/fields';
import { DetectedLabelsResponse } from 'components/Explore/types';
import { GenericBreakdownScene, GenericBreakdownSceneState } from './GenericBreakdownScene';

export interface LabelBreakdownSceneState extends GenericBreakdownSceneState {
  body?: SceneObject;
  labels: Array<SelectableValue<string>>;
  value?: string;
  loading?: boolean;
  error?: string;
  blockingMessage?: string;
  changeLabels?: (n: string[]) => void;
}

export class LabelBreakdownScene extends GenericBreakdownScene<LabelBreakdownSceneState> {
  labels: Array<SelectableValue<string>> = [];
  key?: string | undefined;
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  constructor(state: Partial<LabelBreakdownSceneState>) {
    super({
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [new CustomVariable({ name: VAR_LABEL_GROUP_BY, defaultToAll: true, includeAll: true })],
        }),
      labels: state.labels ?? [],
      loading: true,
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  public static Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const { labels, body, loading, value, blockingMessage }: LabelBreakdownSceneState = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          <div className={styles.controls}>
            {!loading && labels.length > 0 && (
              <div className={styles.controlsLeft}>
                <Field label="By label">
                  <BreakdownLabelSelector options={labels} value={value} onChange={model.onChange} />
                </Field>
              </div>
            )}
            {body instanceof LayoutSwitcher && (
              <div className={styles.controlsRight}>
                <body.Selector model={body} />
              </div>
            )}
          </div>
          <div className={styles.content}>{body && <body.Component model={body} />}</div>
        </StatusWrapper>
      </div>
    );
  };

  public onChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = this.getVariable();

    variable.changeValueTo(value);
  };

  private _onActivate() {
    const variable = this.getVariable();

    variable.subscribeToState((newState, oldState) => {
      if (
        newState.options !== oldState.options ||
        newState.value !== oldState.value ||
        newState.loading !== oldState.loading
      ) {
        this.updateBody(variable);
      }
    });

    this.updateBody(variable);
  }

  private getVariable(): CustomVariable {
    const variable = sceneGraph.lookupVariable(VAR_LABEL_GROUP_BY, this)!;
    if (!(variable instanceof CustomVariable)) {
      throw new Error('Group by variable not found');
    }

    return variable;
  }

  private onReferencedVariableValueChanged() {
    const variable = this.getVariable();
    variable.changeValueTo(ALL_VARIABLE_VALUE);
    this.updateBody(variable);
  }

  private async updateBody(variable: CustomVariable) {
    const ds = await getDatasource(this);

    if (!ds) {
      return;
    }

    const timeRange = sceneGraph.getTimeRange(this).state.value;
    const filters = sceneGraph.lookupVariable(VAR_FILTERS, this)! as AdHocFiltersVariable;

    const { detectedLabels } = await ds.getResource<DetectedLabelsResponse>('detected_labels', {
      query: filters.state.filterExpression,
      start: timeRange.from.utc().toISOString(),
      end: timeRange.to.utc().toISOString(),
    });

    if (!detectedLabels || !Array.isArray(detectedLabels)) {
      return;
    }

    const labels = detectedLabels
      .filter((a) => a.cardinality > 1)
      .sort((a, b) => a.cardinality - b.cardinality)
      .map((l) => l.label);
    const options = getLabelOptions(this, labels);

    const stateUpdate: Partial<LabelBreakdownSceneState> = {
      loading: false,
      value: String(variable.state.value),
      labels: options, // this now includes "all"
      blockingMessage: undefined,
    };

    stateUpdate.body = variable.hasAllValue() ? this.buildAllLayout(options) : buildNormalLayout(variable);

    this.setState(stateUpdate);
  }

  private buildAllLayout(options: Array<SelectableValue<string>>) {
    const children: SceneFlexItemLike[] = [];

    for (const option of options) {
      if (option.value === ALL_VARIABLE_VALUE) {
        continue;
      }

      const queryRunner = new SceneQueryRunner({
        maxDataPoints: 300,
        datasource: explorationDS,
        queries: [
          {
            refId: 'A',
            expr: getExpr(option.value!),
            legendFormat: `{{${option.label}}}`,
          },
        ],
      });

      const body = PanelBuilders.timeseries()
        .setTitle(option.label!)
        .setData(queryRunner)
        .setHeaderActions(new SelectLabelAction({ labelName: String(option.value) }))
        .setHeaderActions(new SelectLabelAction({ labelName: String(option.value) }))
        .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
        .setCustomFieldConfig('fillOpacity', 100)
        .setCustomFieldConfig('lineWidth', 0)
        .setCustomFieldConfig('pointSize', 0)
        .setCustomFieldConfig('drawStyle', DrawStyle.Bars);

      const gridItem = new SceneCSSGridItem({
        body: body.build(),
      });

      this.removeErrorsAndSingleCardinality(queryRunner, gridItem);

      children.push(gridItem);
    }

    return new LayoutSwitcher({
      options: [
        { value: 'grid', label: 'Grid' },
        { value: 'rows', label: 'Rows' },
      ],
      active: 'grid',
      layouts: [
        new SceneCSSGridLayout({
          templateColumns: GRID_TEMPLATE_COLUMNS,
          autoRows: '200px',
          children: children,
        }),
        new SceneCSSGridLayout({
          templateColumns: '1fr',
          autoRows: '200px',
          children: children.map((child) => child.clone()),
        }),
      ],
    });
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
    }),
    content: css({
      flexGrow: 1,
      display: 'flex',
      paddingTop: theme.spacing(0),
    }),
    controls: css({
      flexGrow: 0,
      display: 'flex',
      alignItems: 'top',
      gap: theme.spacing(2),
    }),
    controlsRight: css({
      flexGrow: 0,
      display: 'flex',
      justifyContent: 'flex-end',
    }),
    controlsLeft: css({
      display: 'flex',
      justifyContent: 'flex-left',
      justifyItems: 'left',
      width: '100%',
      flexDirection: 'column',
    }),
  };
}

function getExpr(tagKey: string) {
  return `sum(count_over_time(${LOG_STREAM_SELECTOR_EXPR} | drop __error__ [$__auto])) by (${tagKey})`;
}

function buildQuery(tagKey: string) {
  return {
    refId: 'A',
    expr: getExpr(tagKey),
    queryType: 'range',
    editorMode: 'code',
    maxLines: 1000,
    intervalMs: 2000,
    legendFormat: `{{${tagKey}}}`,
  };
}

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

function buildNormalLayout(variable: CustomVariable) {
  const query = buildQuery(variable.getValueText());

  let bodyOpts = PanelBuilders.timeseries();
  bodyOpts = bodyOpts
    .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('lineWidth', 0)
    .setCustomFieldConfig('pointSize', 0)
    .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
    .setTitle(variable.getValueText());

  const body = bodyOpts.build();

  return new LayoutSwitcher({
    $data: new SceneQueryRunner({
      datasource: explorationDS,
      maxDataPoints: 300,
      queries: [query],
    }),
    options: [
      { value: 'single', label: 'Single' },
      { value: 'grid', label: 'Grid' },
      { value: 'rows', label: 'Rows' },
    ],
    active: 'grid',
    layouts: [
      new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            minHeight: 300,
            body,
          }),
        ],
      }),
      new ByFrameRepeater({
        body: new SceneCSSGridLayout({
          templateColumns: GRID_TEMPLATE_COLUMNS,
          autoRows: '200px',
          children: [
            new SceneFlexItem({
              body: new SceneReactObject({
                reactNode: <LoadingPlaceholder text="Loading..." />,
              }),
            }),
          ],
        }),
        getLayoutChild: getLayoutChild(
          getLabelValue,
          query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line
        ),
      }),
      new ByFrameRepeater({
        body: new SceneCSSGridLayout({
          templateColumns: '1fr',
          autoRows: '200px',
          children: [
            new SceneFlexItem({
              body: new SceneReactObject({
                reactNode: <LoadingPlaceholder text="Loading..." />,
              }),
            }),
          ],
        }),
        getLayoutChild: getLayoutChild(
          getLabelValue,
          query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line
        ),
      }),
    ],
  });
}

function getLabelValue(frame: DataFrame) {
  const labels = frame.fields[1]?.labels;

  if (!labels) {
    return 'No labels';
  }

  const keys = Object.keys(labels);
  if (keys.length === 0) {
    return 'No labels';
  }

  return labels[keys[0]];
}

export function buildLabelBreakdownActionScene(changeLabelsNumber: (n: string[]) => void) {
  return new SceneFlexItem({
    body: new LabelBreakdownScene({ changeLabels: changeLabelsNumber }),
  });
}

interface SelectLabelActionState extends SceneObjectState {
  labelName: string;
}

export class SelectLabelAction extends SceneObjectBase<SelectLabelActionState> {
  public static Component = ({ model }: SceneComponentProps<AddToFiltersGraphAction>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick}>
        Select
      </Button>
    );
  };

  public onClick = () => {
    getBreakdownSceneFor(this).onChange(this.state.labelName);
  };
}

function getBreakdownSceneFor(model: SceneObject): LabelBreakdownScene {
  if (model instanceof LabelBreakdownScene) {
    return model;
  }

  if (model.parent) {
    return getBreakdownSceneFor(model.parent);
  }

  throw new Error('Unable to find breakdown scene');
}
