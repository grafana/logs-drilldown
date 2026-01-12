// Adapted from grafana/grafana/public/app/core/utils/shortLinks.ts shortLinks.ts
import { memoize } from 'lodash';

import { AppEvents, toUtc, urlUtil } from '@grafana/data';
import { config, getAppEvents, getBackendSrv, locationService } from '@grafana/runtime';
import { SceneTimeRangeLike } from '@grafana/scenes';

import { copyText } from './text';

function buildHostUrl() {
  return `${window.location.protocol}//${window.location.host}${config.appSubUrl}`;
}

function getRelativeURLPath(url: string) {
  let path = url.replace(buildHostUrl(), '');
  return path.startsWith('/') ? path.substring(1, path.length) : path;
}

// Adapted from shortLinks.ts in core
export const createShortLink = memoize(async function (path: string) {
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
});

// Copied from shortLinks.ts in core
const createShortLinkClipboardItem = (path: string) => {
  return new ClipboardItem({
    'text/plain': createShortLink(path),
  });
};

// Copied from shortLinks.ts in core
export const createAndCopyShortLink = async (path: string) => {
  const appEvents = getAppEvents();

  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      await navigator.clipboard.write([createShortLinkClipboardItem(path)]);
    } else {
      const shortLink = await createShortLink(path);
      copyText(shortLink);
    }

    appEvents.publish({
      payload: ['Shortened link copied to clipboard'],
      type: AppEvents.alertSuccess.name,
    });
  } catch (error) {
    // createShortLink already handles error notifications, just log
    console.error('Error in createAndCopyShortLink:', error);
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
export const constructAbsoluteUrl = (timeRange: SceneTimeRangeLike): string => {
  const from = toUtc(timeRange.state.value.from);
  const to = toUtc(timeRange.state.value.to);
  const location = locationService.getLocation();
  const searchParams = urlUtil.getUrlSearchParams();
  searchParams['from'] = from.toISOString();
  searchParams['to'] = to.toISOString();
  return urlUtil.renderUrl(location.pathname, searchParams);
};
