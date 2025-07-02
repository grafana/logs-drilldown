import React, { useRef } from 'react';

import { css } from '@emotion/css';
import { rest } from 'lodash';

import { AdHocVariableFilter, Field, GrafanaTheme2, Labels, LoadingState, SelectableValue } from '@grafana/data';
import {
  AdHocFiltersVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import {
  Button,
  ButtonGroup,
  ButtonSelect,
  IconButton,
  LinkButton,
  Popover,
  PopoverController,
  useStyles2,
} from '@grafana/ui';

import { ValueSlugs } from '../../../services/enums';
import { calculateSparsity, getDetectedFieldType } from '../../../services/fields';
import { FilterOp } from '../../../services/filterTypes';
import { logger } from '../../../services/logger';
import { LokiQuery } from '../../../services/lokiQuery';
import { getValueBreakdownLink } from '../../../services/navigate';
import { getRouteParams } from '../../../services/routing';
import { findObjectOfType } from '../../../services/scenes';
import { testIds } from '../../../services/testIds';
import {
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getValueFromAdHocVariableFilter,
  getValueFromFieldsFilter,
} from '../../../services/variableGetters';
import { EMPTY_VARIABLE_VALUE, LEVEL_VARIABLE_VALUE, VAR_FIELDS } from '../../../services/variables';
import { syncLevelsVariable } from '../../IndexScene/LevelsVariableScene';
import { getDetectedFieldsFrame, getLogsPanelFrame, ServiceScene } from '../ServiceScene';
import { addToFilters, clearFilters, InterpolatedFilterType } from './AddToFiltersButton';
import { NumericFilterPopoverScene } from './NumericFilterPopoverScene';

interface SelectLabelActionSceneState extends SceneObjectState {
  // Custom description
  description?: string;
  fieldType: ValueSlugs;
  hasNumericFilters?: boolean;
  hasSparseFilters?: boolean;
  hideValueDrilldown?: boolean;
  labelName: string;
  popover?: NumericFilterPopoverScene;
  selectedValue?: SelectableValue<string>;
  showPopover: boolean;
}

const INCLUDE_VALUE = 'Include';
const EXCLUDE_VALUE = 'Exclude';
const NUMERIC_FILTER_VALUE = 'Add to filter';

export class SelectLabelActionScene extends SceneObjectBase<SelectLabelActionSceneState> {
  constructor(state: Omit<SelectLabelActionSceneState, 'showPopover'>) {
    super({ ...state, showPopover: false });
    this.addActivationHandler(this.onActivate.bind(this));
  }

  onChange(value: SelectableValue<string>) {
    const variable = this.getVariable();
    const variableName = variable.state.name as InterpolatedFilterType;
    const existingFilter = this.getExistingFilter(variable);
    const fieldValue = getValueFromAdHocVariableFilter(variableName, existingFilter);
    const isIncluded = existingFilter?.operator === FilterOp.NotEqual && fieldValue.value === EMPTY_VARIABLE_VALUE;

    if (isIncluded && value.value === INCLUDE_VALUE) {
      this.clearFilter(variableName);
    } else if (value.value === INCLUDE_VALUE) {
      this.onClickExcludeEmpty(variableName);
    } else if (value.value === EXCLUDE_VALUE) {
      this.onClickIncludeEmpty(variableName);
    } else if (value.value === NUMERIC_FILTER_VALUE) {
      this.onClickNumericFilter(variableName);
    }

    this.setState({
      selectedValue: value,
    });
  }

  public static Component = ({ model }: SceneComponentProps<SelectLabelActionScene>) => {
    const {
      fieldType,
      hasNumericFilters,
      hasSparseFilters,
      hideValueDrilldown,
      labelName,
      popover,
      selectedValue,
      showPopover,
    } = model.useState();
    const variable = model.getVariable();
    const variableName = variable.useState().name as InterpolatedFilterType;
    const existingFilter = model.getExistingFilter(variable);
    const fieldValue = getValueFromAdHocVariableFilter(variableName, existingFilter);
    const styles = useStyles2(getStyles);
    const popoverRef = useRef<HTMLButtonElement>(null);
    const filterButtonDisabled =
      fieldType === ValueSlugs.label &&
      variable.state.name === VAR_FIELDS &&
      variable.state.filters.filter((f) => f.key !== labelName && f.operator === FilterOp.Equal).length === 0;

    const isIncluded = existingFilter?.operator === FilterOp.NotEqual && fieldValue.value === EMPTY_VARIABLE_VALUE;
    const hasOtherFilter = !!existingFilter;

    const selectedOptionValue =
      selectedValue?.value ?? (isIncluded ? INCLUDE_VALUE : hasNumericFilters ? NUMERIC_FILTER_VALUE : INCLUDE_VALUE);

    const hasExistingNumericFilter = existingFilter?.operator
      ? [FilterOp.gte, FilterOp.gt, FilterOp.lte, FilterOp.lt].includes(existingFilter.operator)
      : false;
    const numericSelected = selectedOptionValue === NUMERIC_FILTER_VALUE || hasExistingNumericFilter;
    const includeSelected = selectedOptionValue === INCLUDE_VALUE && !numericSelected;

    const sparseIncludeOption: SelectableValue<string> = {
      component: () => (
        <SelectableValueComponent selected={includeSelected} text={`Include all log lines with ${labelName}`} />
      ),
      value: INCLUDE_VALUE,
    };
    const sparseExcludeOption: SelectableValue<string> = {
      component: () => <SelectableValueComponent selected={false} text={`Exclude all log lines with ${labelName}`} />,
      value: EXCLUDE_VALUE,
    };
    const numericFilterOption: SelectableValue<string> = {
      component: () => (
        <SelectableValueComponent selected={numericSelected} text={`Add an expression, i.e. ${labelName} > 30`} />
      ),
      value: NUMERIC_FILTER_VALUE,
    };

    const options: Array<SelectableValue<string>> = [];
    if (hasNumericFilters) {
      options.push(numericFilterOption);
    }

    if (hasSparseFilters) {
      if (!hasExistingNumericFilter) {
        options.push(sparseIncludeOption);
      }

      options.push(sparseExcludeOption);
    }

    const defaultOption = isIncluded
      ? sparseIncludeOption
      : hasNumericFilters
      ? numericFilterOption
      : sparseIncludeOption;

    const panel = sceneGraph.getAncestor(model, VizPanel);
    const $panelData = sceneGraph.getData(panel);
    // Need to re-render on data changes now, or disabled button state might get stale.
    const { data } = $panelData.useState();
    const hasData = (data?.series.length ?? 0) > 0;
    const isError = (data?.errors?.length ?? 0) > 0;
    const disabled = !hasData && isError;

    return (
      <>
        {hasOtherFilter && (
          <IconButton
            disabled={filterButtonDisabled}
            name={'filter'}
            tooltip={`Clear ${labelName} filters`}
            onClick={() => model.clearFilters(variableName)}
          />
        )}
        {(hasNumericFilters || hasSparseFilters) && (
          <>
            <ButtonGroup data-testid={testIds.breakdowns.common.filterButtonGroup}>
              <Button
                data-testid={testIds.breakdowns.common.filterButton}
                ref={popoverRef}
                onClick={() => model.onChange(selectedValue ?? defaultOption)}
                size={'sm'}
                fill={'outline'}
                variant={'secondary'}
              >
                {selectedValue?.value ?? defaultOption.value}
              </Button>
              <ButtonSelect
                data-testid={testIds.breakdowns.common.filterSelect}
                className={styles.buttonSelect}
                variant={'default'}
                options={options}
                onChange={(value) => {
                  model.onChange(value);
                }}
              />
            </ButtonGroup>
          </>
        )}
        {hideValueDrilldown !== true && (
          <LinkButton
            disabled={disabled}
            title={`View breakdown of values for ${labelName}`}
            variant="primary"
            fill="outline"
            size="sm"
            aria-label={`Select ${labelName}`}
            href={model.getViewValuesLink()}
          >
            Select
          </LinkButton>
        )}

        {popover && (
          <PopoverController content={<popover.Component model={popover} />}>
            {(showPopper, hidePopper, popperProps) => {
              const blurFocusProps = {
                onBlur: hidePopper,
                onFocus: showPopper,
              };

              return (
                <>
                  {popoverRef.current && (
                    <>
                      <Popover
                        {...popperProps}
                        {...rest}
                        show={showPopover}
                        wrapperClassName={styles.popover}
                        referenceElement={popoverRef.current}
                        renderArrow={true}
                        {...blurFocusProps}
                      />
                    </>
                  )}
                </>
              );
            }}
          </PopoverController>
        )}
      </>
    );
  };

  private getExistingFilter(variable?: AdHocFiltersVariable): AdHocVariableFilter | undefined {
    let { labelName } = getRouteParams(this);

    if (this.state.labelName !== labelName) {
      return variable?.state.filters.find((filter) => {
        return filter.key === this.state.labelName;
      });
    }

    return undefined;
  }

  public onActivate() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    if (
      serviceScene.state.$data?.state.data?.state === LoadingState.Done ||
      serviceScene.state.$data?.state.data?.state === LoadingState.Error
    ) {
      this.calculateSparsity();
    }

    this._subs.add(
      sceneGraph.getData(this).subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done) {
          if (
            serviceScene.state.$data?.state.data?.state === LoadingState.Done ||
            serviceScene.state.$data?.state.data?.state === LoadingState.Error
          ) {
            this.calculateSparsity();
          }

          this._subs.add(
            serviceScene.state.$data?.subscribeToState((newLogsPanelState) => {
              if (
                serviceScene.state.$data?.state.data?.state === LoadingState.Done ||
                serviceScene.state.$data?.state.data?.state === LoadingState.Error
              ) {
                this.calculateSparsity();
              }
            })
          );
        }
      })
    );
  }

  public onClickNumericFilter = (variableType: InterpolatedFilterType) => {
    const detectedFieldFrame = getDetectedFieldsFrame(this);
    const fieldType = getDetectedFieldType(this.state.labelName, detectedFieldFrame);

    if (!fieldType || fieldType === 'string' || fieldType === 'boolean') {
      const error = new Error(`Incorrect field type: ${fieldType}`);
      logger.error(error, { msg: `onClickNumericFilter invalid field type ${fieldType}` });
      throw error;
    }

    this.setState({
      popover: new NumericFilterPopoverScene({ fieldType, labelName: this.state.labelName, variableType }),
    });
    this.togglePopover();
  };

  public getViewValuesLink = () => {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    return getValueBreakdownLink(this.state.fieldType, this.state.labelName, serviceScene);
  };

  public onClickExcludeEmpty = (variableType: InterpolatedFilterType) => {
    addToFilters(this.state.labelName, EMPTY_VARIABLE_VALUE, 'exclude', this, variableType);
  };

  public onClickIncludeEmpty = (variableType: InterpolatedFilterType) => {
    // If json do we want != '{}'?
    addToFilters(this.state.labelName, EMPTY_VARIABLE_VALUE, 'include', this, variableType);
  };

  public clearFilter = (variableType: InterpolatedFilterType) => {
    addToFilters(this.state.labelName, EMPTY_VARIABLE_VALUE, 'clear', this, variableType);
  };

  public clearFilters = (variableType: InterpolatedFilterType) => {
    clearFilters(this.state.labelName, this, variableType);
    if (this.state.labelName === LEVEL_VARIABLE_VALUE) {
      syncLevelsVariable(this);
    }
  };

  public togglePopover() {
    this.setState({
      showPopover: !this.state.showPopover,
    });
  }

  private calculateSparsity() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const logsPanelData = getLogsPanelFrame(serviceScene.state.$data?.state.data);
    const labels: Field<Labels> | undefined = logsPanelData?.fields.find((field) => field.name === 'labels');

    const data = sceneGraph.getData(this);
    const queryRunner = findObjectOfType(data, (o) => o instanceof SceneQueryRunner, SceneQueryRunner);
    if (queryRunner) {
      const queries = queryRunner.state.queries;
      const query = queries[0] as LokiQuery | undefined;
      if (query?.expr.includes('avg_over_time')) {
        this.setState({
          hasNumericFilters: true,
        });
      }
    }

    if (!labels || !logsPanelData) {
      this.setState({
        hasSparseFilters: false,
      });
      return;
    }
    const variable = this.getVariable();
    // iterate through all the labels on the log panel query result and count how many times this exists
    const logLinesWithLabelCount = labels.values.reduce((acc, labels) => {
      if (labels?.[this.state.labelName]) {
        acc++;
      }
      return acc;
    }, 0);

    const panel = sceneGraph.getAncestor(this, VizPanel);
    if (logLinesWithLabelCount !== undefined && logsPanelData.length > 0) {
      let description = this.state.description;
      if (this.state.description === undefined) {
        description = calculateSparsity(this, this.state.labelName).description;
      }

      // Update the desc
      panel.setState({
        description,
      });
    } else {
      panel.setState({
        description: undefined,
      });
    }

    // Only show for sparse fields and existing include and exclude filters, which will match an empty string in the value
    const existingFilter = this.getExistingFilter(variable);
    const existingFilterValue =
      existingFilter && variable.state.name === VAR_FIELDS ? getValueFromFieldsFilter(existingFilter) : undefined;

    if (logLinesWithLabelCount < logsPanelData.length || existingFilterValue?.value === EMPTY_VARIABLE_VALUE) {
      this.setState({
        hasSparseFilters: true,
      });
    } else {
      this.setState({
        hasSparseFilters: false,
      });
    }
  }

  private getVariable() {
    if (this.state.fieldType === ValueSlugs.field) {
      return getFieldsVariable(this);
    } else if (this.state.labelName === LEVEL_VARIABLE_VALUE) {
      return getLevelsVariable(this);
    } else {
      return getLabelsVariable(this);
    }
  }
}

function SelectableValueComponent(props: { selected: boolean; text: string }) {
  const styles = useStyles2(getSelectableValueComponentStyles);
  return (
    <span className={styles.description}>
      {props.selected && <span className={styles.selected}></span>}
      {props.text}
    </span>
  );
}

const getSelectableValueComponentStyles = (theme: GrafanaTheme2) => {
  return {
    description: css({
      fontSize: theme.typography.pxToRem(12),
      textAlign: 'left',
    }),
    selected: css({
      '&:before': {
        backgroundColor: theme.colors.warning.main,
        content: '""',
        height: 'calc(100% - 8px)',
        left: 0,
        position: 'absolute',
        top: '4px',
        width: '2px',
      },
      label: 'selectable-value-selected',
    }),
  };
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    buttonSelect: css({
      border: `1px solid ${theme.colors.border.strong}`,
      borderBottomLeftRadius: 0,
      borderLeft: 'none',
      borderTopLeftRadius: 0,
      height: '24px',
      padding: 1,
    }),
    description: css({
      fontSize: theme.typography.pxToRem(12),
      textAlign: 'left',
    }),
    popover: css({
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
    }),
  };
};
