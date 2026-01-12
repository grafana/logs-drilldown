import React from 'react';

import { config, reportInteraction } from '@grafana/runtime';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneTimeRangeLike,
} from '@grafana/scenes';
import { ButtonGroup, Dropdown, IconName, Menu, MenuGroup, ToolbarButton } from '@grafana/ui';

import { constructAbsoluteUrl, createAndCopyShortLink } from '../../services/links';
import { copyText } from '../../services/text';

interface ShortLinkMenuItemData {
  absTime: boolean;
  getUrl: Function;
  icon: IconName;
  key: string;
  label: string;
  shorten: boolean;
}

interface ShortLinkGroupData {
  items: ShortLinkMenuItemData[];
  key: string;
  label: string;
}

export interface ShareButtonSceneState extends SceneObjectState {
  /**
   * Reference to $timeRange
   */
  getSceneTimeRange?: () => SceneTimeRangeLike;
  isOpen: boolean;
  lastSelected: ShortLinkMenuItemData;
  /**
   * Callback on link copy
   */
  onCopyLink?: (shortened: boolean, absTime: boolean, url?: string) => void;
}

export class ShareButtonScene extends SceneObjectBase<ShareButtonSceneState> {
  constructor(state: Partial<ShareButtonSceneState>) {
    super({ isOpen: false, lastSelected: defaultMode, ...state });
  }

  public setIsOpen(isOpen: boolean) {
    this.setState({ isOpen });
  }

  public onCopyLink(shorten: boolean, absTime: boolean, url?: string) {
    if (shorten) {
      createAndCopyShortLink(url || global.location.href);
      reportInteraction('grafana_explore_shortened_link_clicked', { isAbsoluteTime: absTime });
    } else {
      copyText(
        url !== undefined
          ? `${window.location.protocol}//${window.location.host}${config.appSubUrl}${url}`
          : global.location.href
      );

      if (this.state.onCopyLink) {
        this.state.onCopyLink(shorten, absTime, url);
      }
    }
  }

  static MenuActions = ({ model }: SceneComponentProps<ShareButtonScene>) => {
    const menuOptions: ShortLinkGroupData[] = [
      {
        items: [
          {
            absTime: false,
            getUrl: () => undefined,
            icon: 'link',
            key: 'copy-shortened-link',
            label: 'Copy shortened URL',
            shorten: true,
          },
          {
            absTime: false,
            getUrl: () => undefined,
            icon: 'link',
            key: 'copy-link',
            label: 'Copy URL',
            shorten: false,
          },
        ],
        key: 'normal',
        label: 'Normal URL links',
      },
      {
        items: [
          {
            absTime: true,
            getUrl: () => {
              return constructAbsoluteUrl(
                model.state.getSceneTimeRange !== undefined
                  ? model.state.getSceneTimeRange()
                  : sceneGraph.getTimeRange(model)
              );
            },
            icon: 'clock-nine',
            key: 'copy-short-link-abs-time',
            label: 'Copy absolute shortened URL',
            shorten: true,
          },
          {
            absTime: true,
            getUrl: () => {
              return constructAbsoluteUrl(
                model.state.getSceneTimeRange !== undefined
                  ? model.state.getSceneTimeRange()
                  : sceneGraph.getTimeRange(model)
              );
            },
            icon: 'clock-nine',
            key: 'copy-link-abs-time',
            label: 'Copy absolute URL',
            shorten: false,
          },
        ],
        key: 'timesync',
        label: 'Time-sync URL links (share with time range intact)',
      },
    ];

    return (
      <Menu>
        {menuOptions.map((groupOption) => {
          return (
            <MenuGroup key={groupOption.key} label={groupOption.label}>
              {groupOption.items.map((option) => {
                return (
                  <Menu.Item
                    key={option.key}
                    label={option.label}
                    icon={option.icon}
                    onClick={() => {
                      const url = option.getUrl();
                      model.onCopyLink(option.shorten, option.absTime, url);
                      model.setState({
                        lastSelected: option,
                      });
                    }}
                  />
                );
              })}
            </MenuGroup>
          );
        })}
      </Menu>
    );
  };

  static Component = ({ model }: SceneComponentProps<ShareButtonScene>) => {
    const { isOpen, lastSelected } = model.useState();

    return (
      <ButtonGroup>
        <ToolbarButton
          tooltip={lastSelected.label}
          icon={lastSelected.icon}
          variant={'canvas'}
          narrow={true}
          onClick={() => {
            const url = lastSelected.getUrl();
            model.onCopyLink(lastSelected.shorten, lastSelected.absTime, url);
          }}
          aria-label={'Copy shortened URL'}
        >
          <span>Share</span>
        </ToolbarButton>
        <Dropdown
          overlay={<ShareButtonScene.MenuActions model={model} />}
          placement="bottom-end"
          onVisibleChange={model.setIsOpen.bind(model)}
        >
          <ToolbarButton narrow={true} variant={'canvas'} isOpen={isOpen} aria-label={'Open copy link options'} />
        </Dropdown>
      </ButtonGroup>
    );
  };
}

const defaultMode: ShortLinkMenuItemData = {
  absTime: false,
  getUrl: () => undefined,
  icon: 'share-alt',
  key: 'copy-link',
  label: 'Copy shortened URL',
  shorten: true,
};
