// Adapted from grafana/grafana/public/app/core/utils/shortLinks.ts shortLinks.ts
import { useCallback } from 'react';

import { memoize } from 'lodash';

import { useCreateShortUrlMutation } from '@grafana/api-clients/rtkq/shorturl/v1beta1';
import { AppEvents, toUtc, urlUtil } from '@grafana/data';
import { config, getAppEvents, locationService } from '@grafana/runtime';
import { SceneTimeRangeLike } from '@grafana/scenes';

import { logger } from './logger';
import { copyText } from './text';

function buildHostUrl() {
  return `${window.location.protocol}//${window.location.host}${config.appSubUrl}`;
}

function getRelativeURLPath(url: string) {
  let path = url.replace(buildHostUrl(), '');
  return path.startsWith('/') ? path.substring(1, path.length) : path;
}

type CreateShortUrl = ReturnType<typeof useCreateShortUrlMutation>[0];

// Adapted from shortLinks.ts in core
export const createShortLink = memoize(async function (path: string, createShortUrl: CreateShortUrl): Promise<string> {
  try {
    const shortLink = await createShortUrl({
      shortUrl: {
        apiVersion: 'shorturl.grafana.app/v1beta1',
        kind: 'ShortURL',
        // generateName lets the apiserver create the uid, as core's shorturl client does
        metadata: { generateName: 's' },
        spec: { path: getRelativeURLPath(path) },
      },
    }).unwrap();
    const url = `${buildHostUrl()}/goto/${shortLink.metadata.name}`;
    // Mirrors core: on-prem is multi-org so carry the org ID, Cloud (stacks-*) omits it
    return config.namespace.startsWith('stacks-') ? url : `${url}?orgId=${config.bootData.user.orgId}`;
  } catch (err) {
    logger.error(err, { msg: 'Error when creating shortened link' });
    // Drop only this path's cached rejection so a retry makes a new request, then rethrow so createAndCopyShortLink alerts
    createShortLink.cache.delete?.(path);
    throw err;
  }
});

// Copied from shortLinks.ts in core
const createShortLinkClipboardItem = (path: string, createShortUrl: CreateShortUrl) => {
  return new ClipboardItem({
    'text/plain': createShortLink(path, createShortUrl),
  });
};

// Copied from shortLinks.ts in core
export const createAndCopyShortLink = async (path: string, createShortUrl: CreateShortUrl) => {
  const appEvents = getAppEvents();

  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      await navigator.clipboard.write([createShortLinkClipboardItem(path, createShortUrl)]);
    } else {
      const shortLink = await createShortLink(path, createShortUrl);
      copyText(shortLink);
    }

    appEvents.publish({
      payload: ['Shortened link copied to clipboard'],
      type: AppEvents.alertSuccess.name,
    });
  } catch (error) {
    logger.error(error, { msg: 'Error in createAndCopyShortLink:' });
    appEvents.publish({
      payload: ['Error generating shortened link'],
      type: AppEvents.alertError.name,
    });
  }
};

// Binds the mutation trigger from Grafana's store
export const useCreateAndCopyShortLink = () => {
  const [createShortUrl] = useCreateShortUrlMutation();
  return useCallback((path: string) => createAndCopyShortLink(path, createShortUrl), [createShortUrl]);
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
