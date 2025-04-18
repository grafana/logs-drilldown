import {
  ControlsLabel,
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableValueChangedEvent,
} from '@grafana/scenes';
import React from 'react';
import { getLevelsVariable } from '../../services/variableGetters';
import { MetricFindValue, SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';
import { Icon, MultiSelect, useStyles2 } from '@grafana/ui';
import { LEVEL_VARIABLE_VALUE } from '../../services/variables';
import { FilterOp } from '../../services/filterTypes';
import { testIds } from '../../services/testIds';
import { addCurrentUrlToHistory } from '../../services/navigate';

type ChipOption = MetricFindValue & { selected?: boolean };
export interface LevelsVariableSceneState extends SceneObjectState {
  options?: ChipOption[];
  isLoading: boolean;
  visible: boolean;
  isOpen: boolean;
  embedded?: boolean;
}
export const LEVELS_VARIABLE_SCENE_KEY = 'levels-var-custom-renderer';
export class LevelsVariableScene extends SceneObjectBase<LevelsVariableSceneState> {
  constructor(state: Partial<LevelsVariableSceneState>) {
    super({ ...state, isLoading: false, visible: false, key: LEVELS_VARIABLE_SCENE_KEY, isOpen: false });

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
        text: filter.valueLabels?.[0] ?? filter.value,
        selected: true,
        value: filter.value,
      })),
    });
  }

  getTagValues = () => {
    this.setState({ isLoading: true });
    const levelsVar = getLevelsVariable(this);
    const levelsKeys = levelsVar?.state?.getTagValuesProvider?.(
      levelsVar,
      levelsVar.state.filters[0] ?? { key: LEVEL_VARIABLE_VALUE }
    );
    levelsKeys?.then((response) => {
      if (Array.isArray(response.values)) {
        this.setState({
          isLoading: false,
          options: response.values.map((value) => {
            return {
              text: value.text,
              value: value.value ?? value.text,
              selected: levelsVar.state.filters.some((filter) => filter.value === value.text),
            };
          }),
        });
      }
    });
  };

  updateFilters = (skipPublish: boolean, forcePublish?: boolean) => {
    const levelsVar = getLevelsVariable(this);
    const filterOptions = this.state.options?.filter((opt) => opt.selected);

    levelsVar.updateFilters(
      filterOptions?.map((filterOpt) => ({
        key: LEVEL_VARIABLE_VALUE,
        operator: FilterOp.Equal,
        value: filterOpt.text,
      })) ?? [],
      { skipPublish, forcePublish }
    );
  };

  onChangeOptions = (options: SelectableValue[]) => {
    // Save current url to history before the filter change
    addCurrentUrlToHistory();

    this.setState({
      options: this.state.options?.map((value) => {
        if (options.some((opt) => opt.value === value.value)) {
          return { ...value, selected: true };
        }
        return { ...value, selected: false };
      }),
    });

    if (!this.state.isOpen) {
      this.updateFilters(false);
    } else {
      this.updateFilters(true);
    }
  };

  openSelect = (isOpen: boolean) => {
    this.setState({ isOpen });
  };

  onCloseMenu = () => {
    this.openSelect(false);
    // Update filters and run queries on close
    this.updateFilters(false, true);
  };

  static Component = ({ model }: SceneComponentProps<LevelsVariableScene>) => {
    const { options, isLoading, visible, isOpen } = model.useState();
    const styles = useStyles2(getStyles);
    const levelsVar = getLevelsVariable(model);
    levelsVar.useState();

    if (!visible) {
      return null;
    }

    return (
      <div data-testid={testIds.variables.levels.inputWrap} className={styles.wrapper}>
        <ControlsLabel layout="vertical" label={'Log levels'} />
        <MultiSelect
          aria-label={'Log level filters'}
          prefix={<Icon size={'lg'} name={'filter'} />}
          placeholder={'All levels'}
          className={styles.control}
          onChange={model.onChangeOptions}
          onCloseMenu={() => model.onCloseMenu()}
          onOpenMenu={model.getTagValues}
          onFocus={() => model.openSelect(true)}
          menuShouldPortal={true}
          isOpen={isOpen}
          isLoading={isLoading}
          isClearable={true}
          blurInputOnSelect={false}
          closeMenuOnSelect={false}
          openMenuOnFocus={true}
          showAllSelectedWhenOpen={true}
          hideSelectedOptions={false}
          value={options?.filter((v) => v.selected)}
          options={options?.map((val) => ({
            value: val.value,
            label: val.text,
          }))}
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
  control: css({
    flex: '1',
  }),
  wrapper: css({
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
  }),
});
