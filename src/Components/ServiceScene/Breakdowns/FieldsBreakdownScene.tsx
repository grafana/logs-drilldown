import React from 'react';

import { css } from '@emotion/css';

import { DataFrame, GrafanaTheme2, LoadingState } from '@grafana/data';
import {
  QueryRunnerState,
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueOption,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { areArraysEqual } from '../../../services/comparison';
import { CustomConstantVariable, CustomConstantVariableState } from '../../../services/CustomConstantVariable';
import { ValueSlugs } from '../../../services/enums';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { getRouteParams, getUILabelName } from '../../../services/routing';
import { DEFAULT_SORT_BY } from '../../../services/sorting';
import { getFieldGroupByVariable, getLabelsVariable } from '../../../services/variableGetters';
import { clearVariables, getVariablesThatCanBeCleared } from '../../../services/variableHelpers';
import { IndexScene } from '../../IndexScene/IndexScene';
import { RouteProps } from '../../Pages';
import { getDetectedFieldsFrame, ServiceScene } from '../ServiceScene';
import { BreakdownSearchReset, BreakdownSearchScene } from './BreakdownSearchScene';
import { ByFrameRepeater } from './ByFrameRepeater';
import { EmptyLayoutScene } from './EmptyLayoutScene';
import { FieldsAggregatedBreakdownScene } from './FieldsAggregatedBreakdownScene';
import { FieldSelector } from './FieldSelector';
import { FieldValuesBreakdownScene } from './FieldValuesBreakdownScene';
import { LayoutSwitcher } from './LayoutSwitcher';
import { NoMatchingLabelsScene } from './NoMatchingLabelsScene';
import { SortByScene, SortCriteriaChanged } from './SortByScene';
import { StatusWrapper } from './StatusWrapper';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getFieldOptions } from 'services/filters';
import { getSortByPreference } from 'services/store';
import { ALL_VARIABLE_VALUE, VAR_FIELD_GROUP_BY, VAR_LABELS } from 'services/variables';

export const averageFields = ['duration', 'count', 'total', 'bytes'];
export const FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

export interface FieldsBreakdownSceneState extends SceneObjectState {
  blockingMessage?: string;
  body?:
    | (NoMatchingLabelsScene & SceneObject)
    | (FieldsAggregatedBreakdownScene & SceneObject)
    | (FieldValuesBreakdownScene & SceneObject)
    | (EmptyLayoutScene & SceneObject);
  changeFieldCount?: (n: number) => void;
  error?: string;
  loading?: boolean;
  search: BreakdownSearchScene;
  sort: SortByScene;
  value?: string;
}

export class FieldsBreakdownScene extends SceneObjectBase<FieldsBreakdownSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_LABELS],
  });

  constructor(state: Partial<FieldsBreakdownSceneState> & { options?: VariableValueOption[]; value?: string }) {
    super({
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [
            new CustomConstantVariable({
              defaultToAll: false,
              includeAll: true,
              name: VAR_FIELD_GROUP_BY,
              options: state.options ?? [],
              value: state.value ?? ALL_VARIABLE_VALUE,
            }),
          ],
        }),
      loading: true,
      search: new BreakdownSearchScene('fields'),
      sort: new SortByScene({ target: 'fields' }),
      value: state.value ?? ALL_VARIABLE_VALUE,
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const groupByVariable = getFieldGroupByVariable(this);
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    this.setState({
      loading: serviceScene.state.$detectedLabelsData?.state.data?.state !== LoadingState.Done,
    });

    // Subscriptions
    this._subs.add(
      this.subscribeToEvent(BreakdownSearchReset, () => {
        this.state.search.clearValueFilter();
      })
    );
    this._subs.add(this.subscribeToEvent(SortCriteriaChanged, this.handleSortByChange));
    this._subs.add(groupByVariable.subscribeToState(this.variableChanged));

    this._subs.add(
      getLabelsVariable(this).subscribeToState((newState, prevState) => {
        const variable = getFieldGroupByVariable(this);
        let { labelName } = this.getPrimaryLabel();

        const newService = newState.filters.find((filter) => filter.key === labelName);
        const prevService = prevState.filters.find((filter) => filter.key === labelName);

        // If the user changes the primary label
        if (variable.state.value === ALL_VARIABLE_VALUE && newService !== prevService) {
          this.setState({
            body: undefined,
            loading: true,
          });
        }
      })
    );

    this._subs.add(
      serviceScene.state.$detectedFieldsData?.subscribeToState(
        (newState: QueryRunnerState, oldState: QueryRunnerState) => {
          if (newState.data?.state === LoadingState.Done) {
            if (newState.data.series?.[0]) {
              this.updateOptions(newState.data.series?.[0]);
            }
          }
        }
      )
    );

    const detectedFieldsFrame = getDetectedFieldsFrame(this);
    // Need to update labels with current state
    if (detectedFieldsFrame) {
      this.updateOptions(detectedFieldsFrame);
    }
  }

  private getPrimaryLabel(): RouteProps {
    let { breakdownLabel, labelName, labelValue } = getRouteParams(this);
    if (!labelName) {
      const variable = getLabelsVariable(this);
      labelName = variable.state.filters[0].key;
      labelValue = variable.state.filters[0].value;

      return { labelName: getUILabelName(labelName), labelValue };
    }
    return { breakdownLabel, labelName, labelValue };
  }

  private variableChanged = (newState: CustomConstantVariableState, oldState: CustomConstantVariableState) => {
    if (
      newState.value !== oldState.value ||
      !areArraysEqual(newState.options, oldState.options) ||
      this.state.body === undefined ||
      this.state.body instanceof EmptyLayoutScene ||
      this.state.body instanceof NoMatchingLabelsScene
    ) {
      this.updateBody(newState);
    }
  };

  private updateOptions(dataFrame: DataFrame) {
    if (!dataFrame || !dataFrame.length) {
      const indexScene = sceneGraph.getAncestor(this, IndexScene);
      const variablesToClear = getVariablesThatCanBeCleared(indexScene);

      let body;
      if (variablesToClear.length > 1) {
        this.state.changeFieldCount?.(0);
        body = new NoMatchingLabelsScene({ clearCallback: () => clearVariables(this) });
      } else {
        body = new EmptyLayoutScene({ type: 'fields' });
      }
      this.setState({
        body,
        loading: false,
      });
      return;
    }

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const variable = getFieldGroupByVariable(this);
    variable.setState({
      loading: false,
      options: getFieldOptions(dataFrame.fields[0].values.map((v) => String(v))),
      value: serviceScene.state.drillDownLabel ?? ALL_VARIABLE_VALUE,
    });
    this.setState({
      loading: false,
    });
  }

  private handleSortByChange = (event: SortCriteriaChanged) => {
    if (event.target !== 'fields') {
      return;
    }

    const body = this.state.body;
    if (body instanceof FieldValuesBreakdownScene && body.state.body instanceof LayoutSwitcher) {
      body.state.body?.state.layouts.forEach((layout) => {
        const byFrameRepeater = sceneGraph.findDescendents(body, ByFrameRepeater);
        byFrameRepeater.forEach((r) => r.sort(event.sortBy, event.direction));
      });
    }
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.value_breakdown_sort_change,
      {
        criteria: event.sortBy,
        direction: event.direction,
        target: 'fields',
      }
    );
  };

  private updateBody(newState: CustomConstantVariableState) {
    const fieldsVariable = getFieldGroupByVariable(this);

    // We get the labels from the service scene, if we don't have them yet, assume we're loading
    if (!fieldsVariable.state.options || !fieldsVariable.state.options.length) {
      return;
    }

    const stateUpdate: Partial<FieldsBreakdownSceneState> = {};

    if (fieldsVariable.state.options && fieldsVariable.state.options.length <= 1) {
      // If there's 1 or fewer fields build the empty or clear layout UI
      const indexScene = sceneGraph.getAncestor(this, IndexScene);
      const variablesToClear = getVariablesThatCanBeCleared(indexScene);

      if (variablesToClear.length > 1) {
        this.state.changeFieldCount?.(0);
        stateUpdate.body = new NoMatchingLabelsScene({ clearCallback: () => clearVariables(this) });
      } else {
        stateUpdate.body = new EmptyLayoutScene({ type: 'fields' });
      }
    } else {
      // Otherwise update the body, but don't re-instantiate if it's already the right class
      if (newState.value === ALL_VARIABLE_VALUE && this.state.body instanceof FieldValuesBreakdownScene) {
        stateUpdate.body = new FieldsAggregatedBreakdownScene({});
      } else if (newState.value !== ALL_VARIABLE_VALUE && this.state.body instanceof FieldsAggregatedBreakdownScene) {
        stateUpdate.body = new FieldValuesBreakdownScene({});
      } else if (
        // If the body hasn't been created, or the no-data views are active, we want to replace and render the correct scene
        this.state.body === undefined ||
        this.state.body instanceof EmptyLayoutScene ||
        this.state.body instanceof NoMatchingLabelsScene
      ) {
        stateUpdate.body =
          newState.value === ALL_VARIABLE_VALUE
            ? new FieldsAggregatedBreakdownScene({})
            : new FieldValuesBreakdownScene({});
      }
    }

    this.setState(stateUpdate);
  }
  public onFieldSelectorChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = getFieldGroupByVariable(this);
    const { direction, sortBy } = getSortByPreference('fields', DEFAULT_SORT_BY, 'desc');

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.select_field_in_breakdown_clicked,
      {
        field: value,
        previousField: variable.getValueText(),
        sortBy,
        sortByDirection: direction,
        view: 'fields',
      }
    );

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    navigateToValueBreakdown(ValueSlugs.field, value, serviceScene);
  };

  public static LabelsMenu = ({ model }: SceneComponentProps<FieldsBreakdownScene>) => {
    const { body, loading, search } = model.useState();
    const styles = useStyles2(getStyles);
    const variable = getFieldGroupByVariable(model);
    const { options, value } = variable.useState();
    return (
      <div className={styles.labelsMenuWrapper}>
        {body instanceof FieldsAggregatedBreakdownScene && <FieldsAggregatedBreakdownScene.Selector model={body} />}
        {body instanceof FieldValuesBreakdownScene && <FieldValuesBreakdownScene.Selector model={body} />}
        {body instanceof FieldValuesBreakdownScene && <search.Component model={search} />}
        {!loading && options.length > 1 && (
          <FieldSelector label="Field" options={options} value={String(value)} onChange={model.onFieldSelectorChange} />
        )}
      </div>
    );
  };
  public static ValuesMenu = ({ model }: SceneComponentProps<FieldsBreakdownScene>) => {
    const { loading, sort } = model.useState();
    const styles = useStyles2(getStyles);
    const variable = getFieldGroupByVariable(model);
    const { value } = variable.useState();
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

  public static Component = ({ model }: SceneComponentProps<FieldsBreakdownScene>) => {
    const { blockingMessage, body, loading } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ blockingMessage, isLoading: loading }}>
          {body instanceof FieldsAggregatedBreakdownScene && model && <FieldsBreakdownScene.LabelsMenu model={model} />}
          <div className={styles.content}>{body && <body.Component model={body} />}</div>
        </StatusWrapper>
      </div>
    );
  };
}

export const emptyStateStyles = {
  button: css({
    marginLeft: '1.5rem',
  }),
  link: css({
    textDecoration: 'underline',
  }),
};

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
