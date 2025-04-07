import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getDrilldownSlug } from '../../../services/routing';
import { css } from '@emotion/css';
import { setSceneLayout, getSceneLayout } from 'services/store';

export interface LayoutSwitcherState extends SceneObjectState {
  active: LayoutType;
  layouts: SceneObject[];
  options: Array<SelectableValue<LayoutType>>;
}

export type LayoutType = 'single' | 'grid' | 'rows';

export enum LayoutTypeEnum {
  single = 'single',
  grid = 'grid',
  rows = 'rows',
}

export class LayoutSwitcher extends SceneObjectBase<LayoutSwitcherState> {
  public static Selector = LayoutSwitcherComponent;
  constructor(state: LayoutSwitcherState) {
    super({
      ...state,
      active: state.active ?? 'grid',
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public isTopLevelLayoutType = () => {
    // Top layouts do not have 'single' layout type
    const isTopLevel = this.state.options.every((o) => o.value !== LayoutTypeEnum.single);
    return isTopLevel;
  };

  public updateLayout = () => {
    const layout = getSceneLayout();
    if (layout) {
      if (layout === LayoutTypeEnum.single && this.isTopLevelLayoutType()) {
        // top level layouts do not have single layout type default to grid
        this.setState({ active: LayoutTypeEnum.grid });
      } else {
        this.setState({
          active:
            layout === LayoutTypeEnum.grid || layout === LayoutTypeEnum.rows || layout === LayoutTypeEnum.single
              ? layout
              : LayoutTypeEnum.grid,
        });
      }
    }
  };

  public onLayoutChange = (active: LayoutType) => {
    reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.layout_type_changed, {
      layout: active,
      view: getDrilldownSlug(),
    });
    setSceneLayout(active);
    this.setState({ active });
  };

  public onActivate = () => {
    this.updateLayout();
  };

  public static Component = ({ model }: SceneComponentProps<LayoutSwitcher>) => {
    const { layouts, options, active } = model.useState();

    const index = options.findIndex((o) => o.value === active);
    if (index === -1) {
      return null;
    }

    const layout = layouts[index];

    return <layout.Component model={layout} />;
  };
}

function LayoutSwitcherComponent({ model }: { model: LayoutSwitcher }) {
  const { active, options } = model.useState();
  const styles = useStyles2(getStyles);

  return (
    <Field className={styles.field}>
      <RadioButtonGroup options={options} value={active} onChange={model.onLayoutChange} />
    </Field>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    field: css({
      marginBottom: 0,
    }),
  };
};
