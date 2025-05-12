import React from 'react';

import { css } from '@emotion/css';

import { AdHocVariableFilter, DataFrame, GrafanaTheme2, LoadingState } from '@grafana/data';
import {
  QueryRunnerState,
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
  SceneVariableState,
  VariableDependencyConfig,
  VariableValueOption,
} from '@grafana/scenes';
import { Alert, useStyles2 } from '@grafana/ui';

import { areArraysEqual } from '../../../services/comparison';
import { CustomConstantVariable, CustomConstantVariableState } from '../../../services/CustomConstantVariable';
import { ValueSlugs } from '../../../services/enums';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { DEFAULT_SORT_BY } from '../../../services/sorting';
import { getLabelGroupByVariable, getLabelsVariable } from '../../../services/variableGetters';
import { getDetectedLabelsFrame, ServiceScene } from '../ServiceScene';
import { BreakdownSearchReset, BreakdownSearchScene } from './BreakdownSearchScene';
import { ByFrameRepeater } from './ByFrameRepeater';
import { EmptyLayoutScene } from './EmptyLayoutScene';
import { FieldSelector } from './FieldSelector';
import { LabelsAggregatedBreakdownScene } from './LabelsAggregatedBreakdownScene';
import { LabelValuesBreakdownScene } from './LabelValuesBreakdownScene';
import { SortByScene, SortCriteriaChanged } from './SortByScene';
import { StatusWrapper } from './StatusWrapper';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getLabelOptions } from 'services/filters';
import { checkPrimaryLabel, getPrimaryLabelFromUrl } from 'services/routing';
import { getSortByPreference } from 'services/store';
import { ALL_VARIABLE_VALUE, SERVICE_NAME, SERVICE_UI_LABEL, VAR_LABEL_GROUP_BY, VAR_LABELS } from 'services/variables';

export interface LabelBreakdownSceneState extends SceneObjectState {
  blockingMessage?: string;
  body?: SceneObject;
  error?: boolean;
  loading?: boolean;
  search: BreakdownSearchScene;
  sort: SortByScene;
  // We have to store the value in state because scenes doesn't allow variables that don't have options. We need to hold on to this until the API call getting values is done, and then reset the state
  value?: string;
}

export class LabelBreakdownScene extends SceneObjectBase<LabelBreakdownSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_LABELS],
  });

  // Labels/options can be passed in when instantiated, but should ONLY exist on the state of the variable
  constructor(state: Partial<LabelBreakdownSceneState> & { options?: VariableValueOption[]; value?: string }) {
    super({
      ...state,
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [
            new CustomConstantVariable({
              defaultToAll: false,
              includeAll: true,
              name: VAR_LABEL_GROUP_BY,
              options: state.options ?? [],
              value: state.value ?? ALL_VARIABLE_VALUE,
            }),
          ],
        }),
      loading: true,
      search: new BreakdownSearchScene('labels'),
      sort: new SortByScene({ target: 'labels' }),
      value: state.value,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const groupByVariable = getLabelGroupByVariable(this);

    this.setState({
      error: serviceScene.state.$detectedLabelsData?.state.data?.state === LoadingState.Error,
      loading: serviceScene.state.$detectedLabelsData?.state.data?.state !== LoadingState.Done,
    });

    this._subs.add(
      this.subscribeToEvent(BreakdownSearchReset, () => {
        this.state.search.clearValueFilter();
      })
    );
    this._subs.add(this.subscribeToEvent(SortCriteriaChanged, this.handleSortByChange));

    this._subs.add(serviceScene.state.$detectedLabelsData?.subscribeToState(this.onDetectedLabelsDataChange));

    this._subs.add(
      getLabelsVariable(this).subscribeToState((newState, prevState) => {
        this.onLabelsVariableChange(newState, prevState);
      })
    );

    this._subs.add(
      groupByVariable.subscribeToState((newState, prevState) => {
        this.onGroupByVariableChange(newState, prevState);
      })
    );

    const detectedLabelsFrame = getDetectedLabelsFrame(this);
    // Need to update labels with current state
    if (detectedLabelsFrame) {
      this.updateOptions(detectedLabelsFrame);
    }

    // checkPrimaryLabel(this);
  }

  private onGroupByVariableChange(newState: CustomConstantVariableState, prevState: CustomConstantVariableState) {
    // If the aggregation value changed, or the body is not yet defined
    if (
      newState.value !== prevState.value ||
      !areArraysEqual(newState.options, prevState.options) ||
      this.state.body === undefined ||
      this.state.body instanceof EmptyLayoutScene
    ) {
      this.updateBody();
    }
  }

  private onLabelsVariableChange(
    newState: SceneVariableState & { filters: AdHocVariableFilter[] },
    prevState: SceneVariableState & { filters: AdHocVariableFilter[] }
  ) {
    let { labelName } = getPrimaryLabelFromUrl();
    if (labelName === SERVICE_UI_LABEL) {
      labelName = SERVICE_NAME;
    }
    const variable = getLabelGroupByVariable(this);
    const newPrimaryLabel = newState.filters.find((filter) => filter.key === labelName);
    const prevPrimaryLabel = prevState.filters.find((filter) => filter.key === labelName);

    // If the user changes the service
    if (variable.state.value === ALL_VARIABLE_VALUE && newPrimaryLabel !== prevPrimaryLabel) {
      this.setState({
        body: undefined,
        error: undefined,
        loading: true,
      });
    }
  }

  /**
   * Pull the detected_labels from our service scene, update the variable when they change
   * @param newState
   * @param prevState
   */
  private onDetectedLabelsDataChange = (newState: QueryRunnerState, prevState: QueryRunnerState) => {
    if (
      newState.data?.state === LoadingState.Done &&
      newState.data.series?.[0] &&
      !areArraysEqual(newState.data.series?.[0]?.fields, prevState.data?.series?.[0]?.fields)
    ) {
      this.updateOptions(newState.data.series?.[0]);
    } else if (newState.data?.state === LoadingState.Done) {
      // we got a new response, but nothing changed, just need to clear loading
      const variable = getLabelGroupByVariable(this);
      variable.setState({
        loading: false,
      });
    }
  };

  private handleSortByChange = (event: SortCriteriaChanged) => {
    if (event.target !== 'labels') {
      return;
    }
    const body = this.state.body;
    if (body instanceof LabelValuesBreakdownScene) {
      const byFrameRepeaters = sceneGraph.findDescendents(body, ByFrameRepeater);
      byFrameRepeaters.forEach((layout) => {
        layout.sort(event.sortBy, event.direction);
      });
    }
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.value_breakdown_sort_change,
      {
        criteria: event.sortBy,
        direction: event.direction,
        target: 'labels',
      }
    );
  };

  private updateOptions(detectedLabels: DataFrame | undefined) {
    if (!detectedLabels || !detectedLabels.length) {
      this.setState({
        body: new EmptyLayoutScene({ type: 'labels' }),
        loading: false,
      });
      return;
    }
    const variable = getLabelGroupByVariable(this);
    const options = getLabelOptions(detectedLabels.fields.map((label) => label.name));

    variable.setState({
      loading: false,
      options,
      value: this.state.value ?? ALL_VARIABLE_VALUE,
    });
  }

  private updateBody() {
    const variable = getLabelGroupByVariable(this);
    // We get the labels from the service scene, if we don't have them yet, assume we're loading
    if (!variable.state.options || !variable.state.options.length) {
      return;
    }

    const stateUpdate: Partial<LabelBreakdownSceneState> = {
      blockingMessage: undefined,
      error: false,
      loading: false,
    };

    if (variable.hasAllValue() && this.state.body instanceof LabelValuesBreakdownScene) {
      stateUpdate.body = new LabelsAggregatedBreakdownScene({});
    } else if (!variable.hasAllValue() && this.state.body instanceof LabelsAggregatedBreakdownScene) {
      stateUpdate.body = new LabelValuesBreakdownScene({});
    } else if (this.state.body === undefined) {
      if (variable.state.options.length > 0) {
        stateUpdate.body = variable.hasAllValue()
          ? new LabelsAggregatedBreakdownScene({})
          : new LabelValuesBreakdownScene({});
      } else {
        stateUpdate.body = new EmptyLayoutScene({ type: 'labels' });
      }
    } else if (this.state.body instanceof EmptyLayoutScene) {
      if (variable.state.options.length > 0) {
        stateUpdate.body = variable.hasAllValue()
          ? new LabelsAggregatedBreakdownScene({})
          : new LabelValuesBreakdownScene({});
      }
    }

    this.setState({ ...stateUpdate });
  }

  public onChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = getLabelGroupByVariable(this);
    variable.changeValueTo(value);

    const { direction, sortBy } = getSortByPreference('labels', DEFAULT_SORT_BY, 'desc');
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.select_field_in_breakdown_clicked,
      {
        label: value,
        previousLabel: variable.getValueText(),
        sortBy,
        sortByDirection: direction,
        view: 'labels',
      }
    );

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    navigateToValueBreakdown(ValueSlugs.label, value, serviceScene);
  };

  public static LabelsMenu = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const { body, loading, search } = model.useState();
    const variable = getLabelGroupByVariable(model);
    const { options, value } = variable.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.labelsMenuWrapper}>
        {body instanceof LabelValuesBreakdownScene && <LabelValuesBreakdownScene.Selector model={body} />}
        {body instanceof LabelsAggregatedBreakdownScene && <LabelsAggregatedBreakdownScene.Selector model={body} />}
        {body instanceof LabelValuesBreakdownScene && <search.Component model={search} />}
        {!loading && options.length > 0 && (
          <FieldSelector label="Label" options={options} value={String(value)} onChange={model.onChange} />
        )}
      </div>
    );
  };

  public static ValuesMenu = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const { loading, sort } = model.useState();
    const variable = getLabelGroupByVariable(model);
    const { value } = variable.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.valuesMenuWrapper}>
        {!loading && value !== ALL_VARIABLE_VALUE && (
          <>
            <sort.Component model={sort} />
          </>
        )}
      </div>
    );
  };

  public static Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const { blockingMessage, body, error, loading } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ blockingMessage, isLoading: loading }}>
          {error && (
            <Alert title="" severity="warning">
              The labels are not available at this moment. Try using a different time range or check again later.
            </Alert>
          )}

          {body instanceof LabelsAggregatedBreakdownScene && model && <LabelBreakdownScene.LabelsMenu model={model} />}

          <div className={styles.content}>{body && <body.Component model={body} />}</div>
        </StatusWrapper>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      gap: theme.spacing(1),
      minHeight: '100%',
    }),
    content: css({
      display: 'flex',
      flexGrow: 1,
      paddingTop: theme.spacing(0),
    }),
    labelsMenuWrapper: css({
      alignItems: 'top',
      display: 'flex',
      flexDirection: 'row-reverse',
      flexGrow: 0,
      gap: theme.spacing(2),
      justifyContent: 'space-between',
    }),
    valuesMenuWrapper: css({
      alignItems: 'top',
      display: 'flex',
      flexDirection: 'row',
      flexGrow: 0,
      gap: theme.spacing(2),
    }),
  };
}
