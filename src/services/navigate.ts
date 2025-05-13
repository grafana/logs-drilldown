import { UrlQueryMap, urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';

import { IndexScene } from '../Components/IndexScene/IndexScene';
import { ServiceScene } from '../Components/ServiceScene/ServiceScene';
import { PageSlugs, ValueSlugs } from './enums';
import { replaceSlash } from './extensions/links';
import { getMetadataService } from './metadata';
import { prefixRoute } from './plugin';
import { buildServicesUrl, DRILLDOWN_URL_KEYS, ROUTES } from './routing';
import { ALL_VARIABLE_VALUE } from './variables';

let previousRoute: string | undefined = undefined;

function buildValueBreakdownUrl(label: string, newPath: ValueSlugs, labelValue: string, labelName = 'service') {
  if (label === ALL_VARIABLE_VALUE && newPath === ValueSlugs.label) {
    return prefixRoute(`${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${PageSlugs.labels}`);
  } else if (label === ALL_VARIABLE_VALUE && newPath === ValueSlugs.field) {
    return prefixRoute(`${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${PageSlugs.fields}`);
  } else {
    return prefixRoute(
      `${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${newPath}/${replaceSlash(label)}`
    );
  }
}

function buildEmbedValueBreakdownUrl(label: string, newPath: ValueSlugs, queryPrams: UrlQueryMap): string {
  queryPrams['pageSlug'] = newPath;
  queryPrams['drillDownLabel'] = label;
  return urlUtil.renderUrl(ROUTES.embed(), queryPrams);
}

export function buildDrilldownPageUrl(path: PageSlugs | string, extraQueryParams?: UrlQueryMap): string {
  return urlUtil.renderUrl(path, buildDrilldownPageRoute(extraQueryParams));
}

export function buildDrilldownPageRoute(extraQueryParams?: UrlQueryMap): UrlQueryMap {
  return {
    ...Object.entries(urlUtil.getUrlSearchParams()).reduce<UrlQueryMap>((acc, [key, value]) => {
      if (DRILLDOWN_URL_KEYS.includes(key)) {
        acc[key] = value;
      }

      return acc;
    }, {}),
    ...extraQueryParams,
  };
}

export function getValueBreakdownLink(newPath: ValueSlugs, label: string, serviceScene: ServiceScene) {
  const indexScene = sceneGraph.getAncestor(serviceScene, IndexScene);
  const urlLabelName = indexScene.state.routeMatch?.params.labelName;
  const urlLabelValue = indexScene.state.routeMatch?.params.labelValue;

  if (urlLabelName && urlLabelValue) {
    let urlPath = buildValueBreakdownUrl(label, newPath, urlLabelValue, urlLabelName);
    const fullUrl = buildDrilldownPageUrl(urlPath);

    // If we're going to navigate, we need to share the state between this instantiation of the service scene
    if (serviceScene) {
      const metadataService = getMetadataService();
      metadataService.setServiceSceneState(serviceScene.state);
    }

    return fullUrl;
  } else {
    const searchParams = urlUtil.getUrlSearchParams();
    return buildEmbedValueBreakdownUrl(label, newPath, searchParams);
  }
}

/**
 * Navigate to value breakdown url
 * @param newPath
 * @param label
 * @param serviceScene
 */
export function navigateToValueBreakdown(newPath: ValueSlugs, label: string, serviceScene: ServiceScene) {
  const link = getValueBreakdownLink(newPath, label, serviceScene);
  if (link) {
    pushUrlHandler(link);
  }
}

/**
 * The case for initial navigation from the service selection to the service index is a special case, as we don't yet have a serviceScene constructed to pull the selected service.
 * This function will route users to the initial (logs) page from the service selection view, which will populate the service scene state with the selected service string.
 * @param labelName
 * @param labelValue
 * @param labelFilters
 */
export function getDrillDownIndexLink(labelName: string, labelValue: string, labelFilters?: UrlQueryMap) {
  return buildDrilldownPageUrl(ROUTES.logs(labelValue, labelName), labelFilters);
}

export function getDrillDownTabLink(path: PageSlugs, serviceScene: ServiceScene, extraQueryParams?: UrlQueryMap) {
  const indexScene = sceneGraph.getAncestor(serviceScene, IndexScene);
  const urlLabelValue = indexScene.state.routeMatch?.params.labelValue;
  const urlLabelName = indexScene.state.routeMatch?.params.labelName;

  if (urlLabelValue) {
    const fullUrl = prefixRoute(`${PageSlugs.explore}/${urlLabelName}/${replaceSlash(urlLabelValue)}/${path}`);
    return buildDrilldownPageUrl(fullUrl, extraQueryParams);
  } else {
    // URL not defined, use url params
    if (extraQueryParams === undefined) {
      extraQueryParams = {};
    }
    // extraQueryParams['tab'] = path;
    extraQueryParams['pageSlug'] = path;

    const fullUrl = prefixRoute(PageSlugs.embed);
    return buildDrilldownPageUrl(fullUrl, extraQueryParams);
  }
}

/**
 * Navigates to the drilldown page specified by the path slug
 *
 * @param path
 * @param serviceScene
 * @param extraQueryParams
 */
export function navigateToDrilldownPage(path: PageSlugs, serviceScene: ServiceScene, extraQueryParams?: UrlQueryMap) {
  const drilldownLink = getDrillDownTabLink(path, serviceScene, extraQueryParams);

  if (drilldownLink) {
    // If we're going to navigate, we need to share the state between this instantiation of the service scene
    if (serviceScene) {
      const metadataService = getMetadataService();
      metadataService.setServiceSceneState(serviceScene.state);
    }

    pushUrlHandler(drilldownLink);
    return;
  }
}

/**
 * Get the embedded flag from the singleton
 *
 * Note: Embedded components cannot change location,
 * doing so triggers a re-render of the entire app, and any local state is wiped out and re-initialized with the props passed in from the embedding plugin.
 */
export function isEmbedded(): boolean {
  return getMetadataService()?.getServiceSceneState()?.embedded ?? false;
}

export function pushUrlHandler(newUrl: string) {
  if (!isEmbedded()) {
    previousRoute = newUrl;
    locationService.push(newUrl);
  }
}

export function addCurrentUrlToHistory() {
  // Don't push location when embedded
  if (!isEmbedded()) {
    // Add the current url to browser history before the state is changed so the user can revert their change.
    const location = locationService.getLocation();
    locationService.push(location.pathname + location.search);
  }
}

/**
 * Navigate to the services selection url
 */
export function navigateToIndex() {
  const location = locationService.getLocation();
  const serviceUrl = buildServicesUrl(ROUTES.explore());
  const currentUrl = location.pathname + location.search;
  const search = locationService.getSearch();

  if (serviceUrl === currentUrl || currentUrl.includes(serviceUrl) || isEmbedded()) {
    return;
  }

  if (!search.get('var-filters')) {
    // If we don't have filters, we don't want to keep this url in browser history since this is fired AFTER the url props are made invalid, push the previous route and replace it
    if (previousRoute) {
      locationService.replace(previousRoute);
    }
    locationService.push(serviceUrl);
  } else {
    pushUrlHandler(serviceUrl);
  }
}
