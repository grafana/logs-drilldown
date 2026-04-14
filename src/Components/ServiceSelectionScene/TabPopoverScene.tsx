import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Combobox, ComboboxOption, Stack, useStyles2 } from '@grafana/ui';

import { ServiceSelectionScene } from './ServiceSelectionScene';
import { ServiceSelectionTabsScene } from './ServiceSelectionTabsScene';

export interface TabPopoverSceneState extends SceneObjectState {}

export class TabPopoverScene extends SceneObjectBase<TabPopoverSceneState> {
  public static Component = ({ model }: SceneComponentProps<TabPopoverScene>) => {
    const serviceSelectionScene = sceneGraph.getAncestor(model, ServiceSelectionScene);
    const serviceSelectionTabsScene = sceneGraph.getAncestor(model, ServiceSelectionTabsScene);
    const { showPopover, tabOptions } = serviceSelectionTabsScene.useState();
    const popoverStyles = useStyles2(getPopoverStyles);
    // Combobox menus render in a portal; mount them inside this node so focus and click handling
    const [comboboxMenuContainer, setComboboxMenuContainer] = useState<HTMLDivElement | null>(null);

    const searchLabelsPlaceholder = t(
      'components.service-selection-scene.tab-popover-scene.placeholder-search-labels',
      'Search labels'
    );

    const savedTabIconTitle = t(
      'components.service-selection-scene.tab-popover-scene.icon-saved-tab',
      'Previously selected label'
    );

    const comboboxOptions: Array<ComboboxOption<string>> = useMemo(
      () =>
        tabOptions.map((opt) => ({
          label: opt.label,
          value: opt.value,
          ...(opt.saved ? { description: savedTabIconTitle } : {}),
        })),
      [tabOptions, savedTabIconTitle]
    );

    const selectTab = (value: string) => {
      serviceSelectionTabsScene.toggleShowPopover();
      serviceSelectionScene.setSelectedTab(value);
    };

    // Close the popover when the user clicks outside of the combobox
    useEffect(() => {
      if (!showPopover || !comboboxMenuContainer) {
        return;
      }
      const el = comboboxMenuContainer;
      const onFocusOut = (event: FocusEvent) => {
        const next = event.relatedTarget as Node | null;
        if (next && el.contains(next)) {
          return;
        }
        serviceSelectionTabsScene.setState({ showPopover: false });
      };
      el.addEventListener('focusout', onFocusOut);
      return () => el.removeEventListener('focusout', onFocusOut);
    }, [showPopover, comboboxMenuContainer, serviceSelectionTabsScene]);

    // Combobox does not expose defaultIsOpen; Downshift opens the list on ArrowDown from a focused input.
    useLayoutEffect(() => {
      if (!showPopover || !comboboxMenuContainer) {
        return;
      }
      const input = comboboxMenuContainer.querySelector<HTMLInputElement>('input');
      if (!input) {
        return;
      }
      input.focus();
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          code: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        })
      );
    }, [showPopover, comboboxMenuContainer]);

    if (!showPopover) {
      return null;
    }

    return (
      <Stack direction="column" gap={0} role="tooltip">
        <div ref={setComboboxMenuContainer} className={popoverStyles.card.body}>
          <Combobox<string>
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={true}
            placeholder={searchLabelsPlaceholder}
            options={comboboxOptions}
            prefixIcon="search"
            onChange={(option) => selectTab(option.value)}
            width="auto"
            minWidth={52}
            maxWidth={90}
          />
        </div>
      </Stack>
    );
  };
}

const getPopoverStyles = (theme: GrafanaTheme2) => ({
  card: {
    body: css({
      padding: theme.spacing(1),
      minWidth: theme.spacing(52),
    }),
  },
});
