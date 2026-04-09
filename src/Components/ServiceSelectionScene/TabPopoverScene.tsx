import React, { useEffect, useMemo, useRef, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Icon, Input, ScrollContainer, Stack, useStyles2 } from '@grafana/ui';

import { ServiceSelectionScene } from './ServiceSelectionScene';
import { ServiceSelectionTabsScene } from './ServiceSelectionTabsScene';

export interface TabPopoverSceneState extends SceneObjectState {}

export class TabPopoverScene extends SceneObjectBase<TabPopoverSceneState> {
  public static Component = ({ model }: SceneComponentProps<TabPopoverScene>) => {
    const serviceSelectionScene = sceneGraph.getAncestor(model, ServiceSelectionScene);
    const serviceSelectionTabsScene = sceneGraph.getAncestor(model, ServiceSelectionTabsScene);
    const { showPopover, tabOptions } = serviceSelectionTabsScene.useState();
    const popoverStyles = useStyles2(getPopoverStyles);
    const popoverBodyRef = useRef<HTMLDivElement>(null);
    const [filter, setFilter] = useState('');

    useEffect(() => {
      if (showPopover) {
        setFilter('');
      }
    }, [showPopover]);

    const filteredTabOptions = useMemo(() => {
      const q = filter.trim().toLowerCase();
      if (!q) {
        return tabOptions;
      }
      return tabOptions.filter((opt) => opt.label.toLowerCase().includes(q));
    }, [tabOptions, filter]);

    const searchLabelsPlaceholder = t(
      'components.service-selection-scene.tab-popover-scene.placeholder-search-labels',
      'Search labels'
    );

    const savedTabIconTitle = t(
      'components.service-selection-scene.tab-popover-scene.icon-saved-tab',
      'Previously selected label'
    );

    const handleInputBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      const next = event.relatedTarget as Node | null;
      if (next && popoverBodyRef.current?.contains(next)) {
        return;
      }
      serviceSelectionTabsScene.toggleShowPopover();
    };

    const selectTab = (value: string) => {
      serviceSelectionTabsScene.toggleShowPopover();
      serviceSelectionScene.setSelectedTab(value);
    };

    if (!showPopover) {
      return null;
    }

    return (
      <Stack direction="column" gap={0} role="tooltip">
        <div ref={popoverBodyRef} className={popoverStyles.card.body}>
          <Stack direction="column" gap={0}>
            <Input
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={true}
              placeholder={searchLabelsPlaceholder}
              value={filter}
              onChange={(e) => setFilter(e.currentTarget.value)}
              onBlur={handleInputBlur}
              suffix={<Icon name="search" />}
            />
            <ScrollContainer maxHeight="50vh">
              <div role="listbox" aria-label={searchLabelsPlaceholder} className={popoverStyles.list.inner}>
                {filteredTabOptions.map((opt) => (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={false}
                    tabIndex={0}
                    className={popoverStyles.list.option}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectTab(opt.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectTab(opt.value);
                      }
                    }}
                  >
                    <Stack direction="row" gap={1} alignItems="center" justifyContent="flex-start">
                      {opt.saved === true && <Icon name="save" size="sm" title={savedTabIconTitle} />}
                      <span className={popoverStyles.list.optionLabel}>{opt.label}</span>
                    </Stack>
                  </div>
                ))}
              </div>
            </ScrollContainer>
          </Stack>
        </div>
      </Stack>
    );
  };
}

const getPopoverStyles = (theme: GrafanaTheme2) => ({
  card: {
    body: css({
      padding: theme.spacing(1),
      minWidth: theme.spacing(30),
    }),
    p: css({
      maxWidth: 300,
    }),
  },
  list: {
    inner: css({
      paddingBottom: theme.spacing(0.5),
    }),
    option: css({
      cursor: 'pointer',
      borderRadius: theme.shape.radius.default,
      padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
      outline: 'none',
      '&:hover, &:focus-visible': {
        background: theme.colors.action.hover,
      },
    }),
    optionLabel: css({
      flex: 1,
      minWidth: 0,
      wordBreak: 'break-word',
    }),
    optionIconSpacer: css({
      display: 'inline-block',
      width: theme.spacing(2),
      flexShrink: 0,
    }),
  },
});
