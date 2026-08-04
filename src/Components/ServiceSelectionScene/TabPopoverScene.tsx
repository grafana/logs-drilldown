import React, { useEffect, useState } from 'react';

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

    // Combobox never positions a dropdown that is open on first render (0x0 menu), so mount closed and open a render later
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
      setMounted(true);
    }, []);

    const comboboxOptions: Array<ComboboxOption<string>> = tabOptions.map((opt) => {
      return {
        icon: opt.saved ? 'save' : undefined,
        label: opt.label,
        value: opt.value,
      };
    });

    return (
      <Stack direction="column" gap={0} role="tooltip">
        <div className={popoverStyles.card.body}>
          <Combobox<string>
            width={50}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={true}
            isOpen={mounted && showPopover}
            onIsOpenChange={(isOpen) => {
              serviceSelectionTabsScene.setShowPopover(isOpen);
            }}
            placeholder={t(
              'components.service-selection-scene.tab-popover-scene.placeholder-search-labels',
              'Search labels'
            )}
            options={comboboxOptions}
            onChange={(option) => {
              // Add value to variable
              if (option.value) {
                // Hide the popover
                serviceSelectionTabsScene.setShowPopover(false);
                // Set new tab
                serviceSelectionScene.setSelectedTab(option.value);
              }
            }}
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
    }),
    p: css({
      maxWidth: 300,
    }),
  },
});
