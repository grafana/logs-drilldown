import React from 'react';

import { AppEvents, toUtc, urlUtil } from '@grafana/data';
import { config, getAppEvents, getBackendSrv, locationService, reportInteraction } from '@grafana/runtime';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneTimeRangeLike,
} from '@grafana/scenes';
import { ButtonGroup, Dropdown, IconName, Menu, MenuGroup, ToolbarButton } from '@grafana/ui';

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

// Adapted from grafana/grafana/public/app/core/utils/shortLinks.ts shortLinks.ts
function buildHostUrl() {
  return `${window.location.protocol}//${window.location.host}${config.appSubUrl}`;
}

function getRelativeURLPath(url: string) {
  let path = url.replace(buildHostUrl(), '');
  return path.startsWith('/') ? path.substring(1, path.length) : path;
}

export const createShortLink = async function (path: string) {
  const appEvents = getAppEvents();
  try {
    const shortLink = await getBackendSrv().post(`/api/short-urls`, {
      path: getRelativeURLPath(path),
    });
    return shortLink.url;
  } catch (err) {
    console.error('Error when creating shortened link: ', err);

    appEvents.publish({
      payload: ['Error generating shortened link'],
      type: AppEvents.alertError.name,
    });
  }
};

export const createAndCopyShortLink = async (path: string) => {
  const appEvents = getAppEvents();
  const shortLink = await createShortLink(path);
  if (shortLink) {
    copyText(shortLink);
    appEvents.publish({
      payload: ['Shortened link copied to clipboard'],
      type: AppEvents.alertSuccess.name,
    });
  } else {
    appEvents.publish({
      payload: ['Error generating shortened link'],
      type: AppEvents.alertError.name,
    });
  }
};

/**
 * Adapted from /grafana/grafana/public/app/features/explore/utils/links.ts
 * Returns the current URL with absolute time range
 */
const constructAbsoluteUrl = (timeRange: SceneTimeRangeLike): string => {
  const from = toUtc(timeRange.state.value.from);
  const to = toUtc(timeRange.state.value.to);
  const location = locationService.getLocation();
  const searchParams = urlUtil.getUrlSearchParams();
  searchParams['from'] = from.toISOString();
  searchParams['to'] = to.toISOString();
  return urlUtil.renderUrl(location.pathname, searchParams);
};
