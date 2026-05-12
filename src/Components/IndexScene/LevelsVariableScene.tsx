import React from 'react';

import { css } from '@emotion/css';

import { MetricFindValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AdHocFilterWithLabels,
  ControlsLabel,
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableValueChangedEvent,
} from '@grafana/scenes';
import { ComboboxOption, MultiCombobox, useStyles2 } from '@grafana/ui';

import { FilterOp } from '../../services/filterTypes';
import { addCurrentUrlToHistory } from '../../services/navigate';
import { testIds } from '../../services/testIds';
import { getLevelsVariable } from '../../services/variableGetters';
import { LEVEL_VARIABLE_VALUE } from '../../services/variables';

type ChipOption = MetricFindValue & { operator?: string; selected?: boolean };
export interface LevelsVariableSceneState extends SceneObjectState {
  isLoading: boolean;
  options?: ChipOption[];
  visible: boolean;
}
export const LEVELS_VARIABLE_SCENE_KEY = 'levels-var-custom-renderer';
export class LevelsVariableScene extends SceneObjectBase<LevelsVariableSceneState> {
  constructor(state: Partial<LevelsVariableSceneState>) {
    super({ ...state, isLoading: false, key: LEVELS_VARIABLE_SCENE_KEY, visible: false });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    this.onFilterChange();

    this._subs.add(
      getLevelsVariable(this).subscribeToEvent(SceneVariableValueChangedEvent, () => {
        this.onFilterChange();
      })
    );
  }

  public onFilterChange() {
    const levelsVar = getLevelsVariable(this);
    this.setState({
      options: levelsVar.state.filters.map((filter) => ({
        selected: true,
        text: filter.valueLabels?.[0] ?? filter.value,
        value: filter.value,
        operator: filter.operator,
      })),
    });
  }

  getTagValues = async (typeAhead: string): Promise<Array<ComboboxOption<string>>> => {
    this.setState({ isLoading: true });
    const levelsVar = getLevelsVariable(this);
    const levelsKeys = levelsVar?.state?.getTagValuesProvider?.(
      levelsVar,
      levelsVar.state.filters[0] ?? { key: LEVEL_VARIABLE_VALUE }
    );

    try {
      const response = await levelsKeys;
      if (!response || !Array.isArray(response.values)) {
        return [];
      }

      const newOptions = response.values.map((value) => ({
        selected: levelsVar.state.filters.some((filter) => filter.value === value.text),
        text: value.text,
        value: value.value ?? value.text,
        operator: FilterOp.Equal,
      }));
      const existingSelectedOptions = this.state.options?.filter(
        (existingOption) =>
          existingOption.selected && !newOptions.some((newOption) => newOption.value === existingOption.value)
      );
      const options = existingSelectedOptions ? [...newOptions, ...existingSelectedOptions] : [...newOptions];
      this.setState({ options });
      return options
        .map((option) => ({ label: option.text, value: String(option.value ?? option.text) }))
        .filter((option) => option.label?.includes(typeAhead));
    } catch (err) {
      return [];
    } finally {
      this.setState({ isLoading: false });
    }
  };

  updateFilters = (skipPublish: boolean, forcePublish?: boolean) => {
    const levelsVar = getLevelsVariable(this);
    const filterOptions = this.state.options?.filter((opt) => opt.selected);

    const filters =
      filterOptions?.map((filterOpt) => {
        const operator = filterOpt.operator ?? FilterOp.Equal;
        const value =
          filterOpt.value !== undefined && filterOpt.value !== ''
            ? String(filterOpt.value)
            : String(filterOpt.text ?? '');
        const filter: AdHocFilterWithLabels = {
          key: LEVEL_VARIABLE_VALUE,
          operator,
          value,
        };
        const displayLabel = filterOpt.text ?? value;
        if (operator === FilterOp.NotEqual) {
          filter.valueLabels = [displayLabel.startsWith('!') ? displayLabel : `!${value}`];
        } else if (displayLabel !== value) {
          filter.valueLabels = [displayLabel];
        }
        return filter;
      }) ?? [];

    levelsVar.updateFilters(filters, { forcePublish, skipPublish });
  };

  onChangeOptions = (options: Array<ComboboxOption<string>>) => {
    // Save current url to history before the filter change
    addCurrentUrlToHistory();
    const selectedValues = new Set(options.map((option) => option.value));
    const optionValues = new Set((this.state.options ?? []).map((option) => String(option.value)));
    const customOptions = options
      .filter((option) => !optionValues.has(option.value))
      .map((option) => ({
        selected: true,
        text: option.label ?? option.value,
        value: option.value,
        operator: FilterOp.Equal,
      }));

    this.setState({
      options: [...(this.state.options ?? []), ...customOptions].map((value) => {
        if (selectedValues.has(String(value.value))) {
          return { ...value, selected: true };
        }
        return { ...value, selected: false };
      }),
    });

    // Updates filters on selection not on dropdown close
    // Combobox does not provide a way to know if the menu is open or closed
    this.updateFilters(false);
  };

  onCloseMenu = () => {
    // Update filters and run queries on close
    this.updateFilters(false, true);
  };

  static Component = ({ model }: SceneComponentProps<LevelsVariableScene>) => {
    const { isLoading, options, visible } = model.useState();
    const styles = useStyles2(getStyles);
    const levelsVar = getLevelsVariable(model);
    levelsVar.useState();

    if (!visible) {
      return null;
    }

    return (
      <div data-testid={testIds.variables.levels.inputWrap} className={styles.wrapper}>
        <ControlsLabel
          layout="vertical"
          label={t('components.index-scene.levels-variable-scene.label-log-levels', 'Log levels')}
          description={t(
            'components.index-scene.levels-variable-scene.description-log-levels',
            'Keep only logs whose detected severity matches your selection (for example error or warn). Leave empty to include all levels.'
          )}
        />
        <MultiCombobox<string>
          aria-label={t(
            'components.index-scene.levels-variable-scene.aria-label-log-level-filters',
            'Log level filters'
          )}
          prefixIcon="filter"
          placeholder={t('components.index-scene.levels-variable-scene.placeholder-all-levels', 'All levels')}
          onChange={model.onChangeOptions}
          options={model.getTagValues}
          createCustomValue={true}
          loading={isLoading}
          value={options
            ?.filter((v) => v.selected)
            .map((option) => ({ label: option.text, value: String(option.value) }))}
          width="auto"
          minWidth={20}
        />
      </div>
    );
  };
}
export function syncLevelsVariable(sceneRef: SceneObject) {
  const levelsVariableScene = sceneGraph.findObject(sceneRef, (obj) => obj instanceof LevelsVariableScene);
  if (levelsVariableScene instanceof LevelsVariableScene) {
    levelsVariableScene.onFilterChange();
  }
}

const getStyles = () => ({
  wrapper: css({
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
  }),
});
