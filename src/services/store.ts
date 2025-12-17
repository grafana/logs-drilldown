import { LogsDedupStrategy } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { sceneGraph, SceneObject, VariableValue } from '@grafana/scenes';
import { Options } from '@grafana/schema/dist/esm/raw/composable/logs/panelcfg/x/LogsPanelCfg_types.gen';

import { CollapsablePanelText, TimeSeriesPanelType } from '../Components/Panels/PanelMenu';
import { FieldsPanelsType } from '../Components/ServiceScene/Breakdowns/FieldsAggregatedBreakdownScene';
import { SortBy, SortDirection } from '../Components/ServiceScene/Breakdowns/SortByScene';
import pluginJson from '../plugin.json';
import { replaceSlash } from './extensions/links';
import { isDedupStrategy } from './guards';
import { logger } from './logger';
import { unknownToStrings } from './narrowing';
import { getRouteParams } from './routing';
import { getDataSourceName } from './variableGetters';
import { SERVICE_NAME, SERVICE_UI_LABEL } from './variables';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { LogLineState } from 'Components/Table/Context/TableColumnsContext';

const FAVORITE_PRIMARY_LABEL_VALUES_LOCALSTORAGE_KEY = `${pluginJson.id}.services.favorite`;
const FAVORITE_PRIMARY_LABEL_NAME_LOCALSTORAGE_KEY = `${pluginJson.id}.primarylabels.tabs.favorite`;
const DS_LOCALSTORAGE_KEY = `${pluginJson.id}.datasource`;
const SCENE_LAYOUT_LOCALSTORAGE_KEY = `${pluginJson.id}.scene.layout`;

// This should be a string, but we'll accept anything and return an empty array if it's not a string
export function getFavoriteLabelValuesFromStorage(dsKey: string | unknown, labelName: string): string[] {
  if (!dsKey || typeof dsKey !== 'string') {
    return [];
  }
  const key = createPrimaryLabelLocalStorageKey(dsKey, labelName);
  let labelValues: string[] = [];
  try {
    labelValues = unknownToStrings(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch (e) {
    logger.error(e, { msg: 'Error parsing favorite services from local storage' });
  }

  if (!Array.isArray(labelValues)) {
    labelValues = [];
  }
  return labelValues;
}

// This should be a string, but we'll accept anything and return early
export function addToFavoriteLabelValueInStorage(dsKey: string | unknown, labelName: string, labelValue: string) {
  if (!dsKey || typeof dsKey !== 'string') {
    return;
  }
  const key = createPrimaryLabelLocalStorageKey(dsKey, labelName);
  let services: string[] = [];
  try {
    services = unknownToStrings(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch (e) {
    logger.error(e, { msg: 'Error parsing favorite services from local storage' });
  }

  if (!Array.isArray(services)) {
    services = [];
  }

  // We want to put this service at the top of the list and remove any duplicates
  const servicesToStore = services.filter((service: string) => service !== labelValue);
  servicesToStore.unshift(labelValue);

  localStorage.setItem(key, JSON.stringify(servicesToStore));
}

export function removeFromFavoritesInStorage(dsKey: VariableValue, labelName: string, labelValue: string) {
  if (!dsKey || !labelName || !labelValue || typeof dsKey !== 'string') {
    return;
  }
  const key = createPrimaryLabelLocalStorageKey(dsKey, labelName);
  let services: string[] = [];
  try {
    services = unknownToStrings(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch (e) {
    logger.error(e, { msg: 'Error parsing favorite services from local storage' });
  }

  if (!Array.isArray(services)) {
    services = [];
  }
  const servicesToStore = services.filter((service: string) => service !== labelValue);
  localStorage.setItem(key, JSON.stringify(servicesToStore));
}

export function addTabToLocalStorage(dsKey: string, labelName: string) {
  if (!dsKey || !labelName) {
    return;
  }

  const key = createTabsLocalStorageKey(dsKey);

  let services: string[] = [];
  try {
    services = unknownToStrings(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch (e) {
    logger.error(e, { msg: 'Error parsing saved tabs from local storage' });
  }

  if (!Array.isArray(services)) {
    services = [];
  }

  if (services.indexOf(labelName) === -1) {
    // We want to put this service at the top of the list and remove any duplicates
    const servicesToStore = services.filter((tabName: string) => tabName !== labelName);
    servicesToStore.unshift(labelName);

    localStorage.setItem(key, JSON.stringify(servicesToStore));
  }
}

export function removeTabFromLocalStorage(dsKey: string, labelName: string) {
  if (!dsKey || !labelName) {
    return;
  }
  const key = createTabsLocalStorageKey(dsKey);
  let services: string[] = [];
  try {
    services = unknownToStrings(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch (e) {
    logger.error(e, { msg: 'Error parsing favorite services from local storage' });
  }

  if (!Array.isArray(services)) {
    services = [];
  }
  const servicesToStore = services.filter((tabName: string) => tabName !== labelName);
  localStorage.setItem(key, JSON.stringify(servicesToStore));
}

export function getFavoriteTabsFromStorage(dsKey: string | unknown): string[] {
  if (!dsKey || typeof dsKey !== 'string') {
    return [];
  }
  const key = createTabsLocalStorageKey(dsKey);
  let tabNames: string[] = [];
  try {
    tabNames = unknownToStrings(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch (e) {
    logger.error(e, { msg: 'Error parsing favorite services from local storage' });
  }

  if (!Array.isArray(tabNames)) {
    tabNames = [];
  }
  return tabNames;
}

function createPrimaryLabelLocalStorageKey(ds: string, labelName: string) {
  if (labelName === SERVICE_NAME) {
    labelName = '';
  } else {
    labelName = `_${labelName}`;
  }
  return `${FAVORITE_PRIMARY_LABEL_VALUES_LOCALSTORAGE_KEY}_${ds}${labelName}`;
}

function createTabsLocalStorageKey(ds: string) {
  return `${FAVORITE_PRIMARY_LABEL_NAME_LOCALSTORAGE_KEY}_${ds}`;
}

export function getLastUsedDataSourceFromStorage(): string | undefined {
  return localStorage.getItem(DS_LOCALSTORAGE_KEY) ?? undefined;
}

export function getDefaultDatasourceFromDatasourceSrv(): string | undefined {
  const dsList = getDataSourceSrv().getList({
    type: 'loki',
  });
  const ds = dsList.find((ds) => ds.isDefault);
  return ds?.uid ?? dsList?.[0]?.uid;
}

export function addLastUsedDataSourceToStorage(dsKey: string) {
  localStorage.setItem(DS_LOCALSTORAGE_KEY, dsKey);
}

const SORT_BY_LOCALSTORAGE_KEY = `${pluginJson.id}.values.sort`;
export function getSortByPreference(
  target: string,
  defaultSortBy: SortBy,
  defaultDirection: SortDirection
): { direction: SortDirection; sortBy: SortBy | '' } {
  const preference = localStorage.getItem(`${SORT_BY_LOCALSTORAGE_KEY}.${target}.by`) ?? '';
  const parts = preference.split('.');
  if (!parts[0] || !parts[1]) {
    return { direction: defaultDirection, sortBy: defaultSortBy };
  }
  const sortBy = parts[0] as SortBy;
  const direction = parts[1] as SortDirection;
  return { direction, sortBy };
}

export function setSortByPreference(target: string, sortBy: string, direction: string) {
  // Prevent storing empty values
  if (sortBy && direction) {
    localStorage.setItem(`${SORT_BY_LOCALSTORAGE_KEY}.${target}.by`, `${sortBy}.${direction}`);
  }
}

function getExplorationPrefix(sceneRef: SceneObject) {
  const { labelName, labelValue } = getRouteParams(sceneRef);
  return getExplorationPrefixForLabelValue(sceneRef, labelName, labelValue);
}

export function getExplorationPrefixForLabelValue(sceneRef: SceneObject, label: string, value: string) {
  const ds = getDataSourceName(sceneRef);
  if (label === SERVICE_NAME || label === SERVICE_UI_LABEL) {
    return `${ds}.${replaceSlash(value)}`;
  }
  return `${ds}.${label}.${replaceSlash(value)}`;
}
// https://github.com/grafana/grafana/blob/3d009ff7edf6095f79e95bc60b728acf04149665/public/app/plugins/datasource/loki/datasource.ts#L102
const DEFAULT_MAX_LINES = 1000;
export function getMaxLines(sceneRef: SceneObject): number {
  const PREFIX = getExplorationPrefix(sceneRef);
  const maxLines = parseInt(localStorage.getItem(`${pluginJson.id}.${PREFIX}.logs.maxLines`) ?? '0', 10);
  if (maxLines > 0) {
    return maxLines;
  }
  const indexScene = sceneGraph.getAncestor(sceneRef, IndexScene);
  const dataSource = indexScene.state.ds;
  return dataSource?.maxLines ?? DEFAULT_MAX_LINES;
}

export function setMaxLines(sceneRef: SceneObject, maxLines: number) {
  const PREFIX = getExplorationPrefix(sceneRef);
  localStorage.setItem(`${pluginJson.id}.${PREFIX}.logs.maxLines`, maxLines.toString());
}

const getDisplayedFieldsKey = (sceneRef: SceneObject, userAdded: boolean, prefix?: string) => {
  const PREFIX = prefix ?? getExplorationPrefix(sceneRef);
  const POSTFIX = userAdded ? 'logs.user.fields' : 'logs.fields';
  return `${pluginJson.id}.${PREFIX}.${POSTFIX}`;
};

export function getDisplayedFieldsInStorage(
  sceneRef: SceneObject,
  userAdded = false,
  options?: { prefix?: string }
): string[] | null {
  const key = getDisplayedFieldsKey(sceneRef, userAdded, options?.prefix);
  const storedFields = localStorage.getItem(key);
  if (storedFields === 'null' || !storedFields) {
    return null;
  }
  if (storedFields) {
    return unknownToStrings(JSON.parse(storedFields));
  }
  return [];
}

export function setDisplayedFieldsInStorage(sceneRef: SceneObject, fields: string[] | null, userAdded = false) {
  const key = getDisplayedFieldsKey(sceneRef, userAdded);
  localStorage.setItem(key, JSON.stringify(fields));
}

export function getDedupStrategy(sceneRef: SceneObject): LogsDedupStrategy {
  const PREFIX = getExplorationPrefix(sceneRef);
  const storedStrategy = localStorage.getItem(`${pluginJson.id}.${PREFIX}.logs.dedupStrategy`);
  if (storedStrategy && isDedupStrategy(storedStrategy)) {
    return storedStrategy;
  }
  return LogsDedupStrategy.none;
}

export function setDedupStrategy(sceneRef: SceneObject, strategy: LogsDedupStrategy) {
  const PREFIX = getExplorationPrefix(sceneRef);
  localStorage.setItem(`${pluginJson.id}.${PREFIX}.logs.dedupStrategy`, strategy);
}

// Log panel options
export const LOG_OPTIONS_LOCALSTORAGE_KEY = `grafana.explore.logs`;
export const LOG_OPTIONS_PATTERNS_LOCALSTORAGE_KEY = `grafana.explore.logs.patterns`;
export function getLogOption<T>(option: keyof Options, defaultValue: T): T {
  const localStorageResult = localStorage.getItem(`${LOG_OPTIONS_LOCALSTORAGE_KEY}.${option}`);
  // TODO: narrow stored value
  return localStorageResult ? (localStorageResult as T) : defaultValue;
}

export function getBooleanLogOption(option: keyof Options | 'controlsExpanded', defaultValue: boolean): boolean {
  const localStorageResult = localStorage.getItem(`${LOG_OPTIONS_LOCALSTORAGE_KEY}.${option}`);
  if (localStorageResult === null) {
    return defaultValue;
  }
  return !(localStorageResult === '' || localStorageResult === 'false');
}

export function setLogOption(
  option: keyof Options | 'maxLines' | 'controlsExpanded',
  value: string | number | boolean
) {
  let storedValue = value.toString();
  localStorage.setItem(`${LOG_OPTIONS_LOCALSTORAGE_KEY}.${option}`, storedValue);
}

// Logs volume options
const LOGS_VOLUME_LOCALSTORAGE_KEY = 'grafana.explore.logs.logsVolume';
export function setLogsVolumeOption(option: 'collapsed', value: string | undefined) {
  const key = `${LOGS_VOLUME_LOCALSTORAGE_KEY}.${option}`;
  if (value === undefined) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, value);
}

export function getLogsVolumeOption(option: 'collapsed') {
  return Boolean(localStorage.getItem(`${LOGS_VOLUME_LOCALSTORAGE_KEY}.${option}`));
}

// Log visualization options
export type LogsVisualizationType = 'json' | 'logs' | 'table';

const VISUALIZATION_TYPE_LOCALSTORAGE_KEY = 'grafana.explore.logs.visualisationType';
export function getLogsVisualizationType(): LogsVisualizationType {
  const storedType = localStorage.getItem(VISUALIZATION_TYPE_LOCALSTORAGE_KEY) ?? '';
  switch (storedType) {
    case 'table':
    case 'logs':
      return storedType;
    case 'json':
      return 'json';
    default:
      return 'logs';
  }
}

export function setLogsVisualizationType(type: string) {
  localStorage.setItem(VISUALIZATION_TYPE_LOCALSTORAGE_KEY, type);
}

const SHOW_ERROR_PANELS_KEY = `${pluginJson.id}.panelOptions.showErrors`;
export function getShowErrorPanels(): boolean {
  return !!localStorage.getItem(SHOW_ERROR_PANELS_KEY);
}

export function setShowErrorPanels(showErrorPanels: boolean) {
  localStorage.setItem(SHOW_ERROR_PANELS_KEY, showErrorPanels ? 'true' : '');
}

// JSON filter debug mode
const JSON_PARSER_PROPS_DEBUG_KEY = `${pluginJson.id}.jsonParser.visible`;
export function getJsonParserVariableVisibility(): boolean {
  // localStorage.setItem('grafana-lokiexplore-app.jsonParser.visible', true)
  return !!localStorage.getItem(JSON_PARSER_PROPS_DEBUG_KEY);
}

// JSON viz metadata node visibility
const JSON_VIZ_METADATA_VISIBLE_KEY = `${pluginJson.id}.jsonViz.metadata`;
export function getJSONMetadataState(): boolean {
  return !!localStorage.getItem(JSON_VIZ_METADATA_VISIBLE_KEY);
}

export function setJSONMetadataVisibility(state: boolean) {
  localStorage.setItem(JSON_VIZ_METADATA_VISIBLE_KEY, state ? 'true' : '');
}

// JSON viz metadata node visibility
const JSON_VIZ_HIGHLIGHT_VISIBLE_KEY = `${pluginJson.id}.jsonViz.highlight`;
export function getJSONHighlightState(): boolean {
  return !!localStorage.getItem(JSON_VIZ_HIGHLIGHT_VISIBLE_KEY);
}

export function setJSONHighlightVisibility(state: boolean) {
  localStorage.setItem(JSON_VIZ_HIGHLIGHT_VISIBLE_KEY, state ? 'true' : '');
}

// JSON viz labels node visibility
const JSON_VIZ_LABELS_VISIBLE_KEY = `${pluginJson.id}.jsonViz.labels`;
export function getJSONLabelsState(): boolean {
  return !!localStorage.getItem(JSON_VIZ_LABELS_VISIBLE_KEY);
}

export function setJSONLabelsVisibility(state: boolean) {
  localStorage.setItem(JSON_VIZ_LABELS_VISIBLE_KEY, state ? 'true' : '');
}

// Line filter options
const LINE_FILTER_OPTIONS_LOCALSTORAGE_KEY = `${pluginJson.id}.linefilter.option`;
export function setLineFilterCase(caseSensitive: boolean) {
  let storedValue = caseSensitive.toString();
  if (!caseSensitive) {
    storedValue = '';
  }

  localStorage.setItem(`${LINE_FILTER_OPTIONS_LOCALSTORAGE_KEY}.caseSensitive`, storedValue);
}

export function setLineFilterRegex(regex: boolean) {
  let storedValue = regex.toString();
  if (!regex) {
    storedValue = '';
  }

  localStorage.setItem(`${LINE_FILTER_OPTIONS_LOCALSTORAGE_KEY}.regex`, storedValue);
}

export function setLineFilterExclusive(exclusive: boolean) {
  let storedValue = exclusive.toString();
  if (!exclusive) {
    storedValue = '';
  }

  localStorage.setItem(`${LINE_FILTER_OPTIONS_LOCALSTORAGE_KEY}.exclusive`, storedValue);
}

export function getLineFilterCase(defaultValue: boolean): boolean {
  const storedValue = localStorage.getItem(`${LINE_FILTER_OPTIONS_LOCALSTORAGE_KEY}.caseSensitive`);
  return storedValue === 'true' ? true : defaultValue;
}

export function getLineFilterRegex(defaultValue: boolean): boolean {
  const storedValue = localStorage.getItem(`${LINE_FILTER_OPTIONS_LOCALSTORAGE_KEY}.regex`);
  return storedValue === 'true' ? true : defaultValue;
}

export function getLineFilterExclusive(defaultValue: boolean): boolean {
  const storedValue = localStorage.getItem(`${LINE_FILTER_OPTIONS_LOCALSTORAGE_KEY}.exclusive`);
  return storedValue === 'true' ? true : defaultValue;
}

// Panel options
const PANEL_OPTIONS_LOCALSTORAGE_KEY = `${pluginJson.id}.panel.option`;
export interface PanelOptions {
  collapsed: CollapsablePanelText;
  panelType: TimeSeriesPanelType;
}
export function getPanelOption<K extends keyof PanelOptions, V extends PanelOptions[K]>(
  option: K,
  values: V[]
): V | null {
  const result = localStorage.getItem(`${PANEL_OPTIONS_LOCALSTORAGE_KEY}.${option}`);
  if (result !== null) {
    return values.find((v) => result === v) ?? null;
  }

  return null;
}

export function setPanelOption<K extends keyof PanelOptions, V extends PanelOptions[K]>(option: K, value: V) {
  localStorage.setItem(`${PANEL_OPTIONS_LOCALSTORAGE_KEY}.${option}`, value);
}

const EXPRESSION_BUILDER_DEBUG_LOCALSTORAGE_KEY = `${pluginJson.id}.expressionBuilder.debug`;
export function getExpressionBuilderDebug() {
  const value = localStorage.getItem(EXPRESSION_BUILDER_DEBUG_LOCALSTORAGE_KEY);
  return !!value;
}

const SERVICE_SELECTION_PAGE_COUNT_KEY = `${pluginJson.id}.serviceSelection.pageCount`;

export function getServiceSelectionPageCount(): number | undefined {
  const value = localStorage.getItem(SERVICE_SELECTION_PAGE_COUNT_KEY);
  return value ? parseInt(value, 10) : undefined;
}
export function setServiceSelectionPageCount(pageCount: number) {
  localStorage.setItem(SERVICE_SELECTION_PAGE_COUNT_KEY, pageCount.toString(10));
}

export function getSceneLayout(): string | null {
  const value = localStorage.getItem(SCENE_LAYOUT_LOCALSTORAGE_KEY);
  return value;
}
export function setSceneLayout(layout: string) {
  localStorage.setItem(SCENE_LAYOUT_LOCALSTORAGE_KEY, layout);
}

const FIELDS_PANEL_TYPES = `${pluginJson.id}.fieldsBreakdown.fieldsPanelType`;
export function getFieldsPanelTypes(): FieldsPanelsType | null {
  const stored = localStorage.getItem(FIELDS_PANEL_TYPES);
  if (stored === 'text' || stored === 'timeseries') {
    return stored;
  }
  return null;
}

export function setFieldsPanelTypes(panelTypes: FieldsPanelsType) {
  localStorage.setItem(FIELDS_PANEL_TYPES, panelTypes);
}

// Collapsible filters
const COLLAPSIBLE_FILTERS_KEY = `${pluginJson.id}.filters.collapsed`;
export function getCollapsibleFiltersState(): boolean {
  return !!localStorage.getItem(COLLAPSIBLE_FILTERS_KEY);
}

export function setCollapsibleFiltersState(state: boolean) {
  localStorage.setItem(COLLAPSIBLE_FILTERS_KEY, state ? 'true' : '');
}

// Table settings
const TABLE_LOG_LINE_LOCALSTORAGE_KEY = `${pluginJson.id}.table.logLine`;
export function getTableLogLine(): LogLineState {
  return localStorage.getItem(TABLE_LOG_LINE_LOCALSTORAGE_KEY) as LogLineState;
}
export function setTableLogLine(value: LogLineState) {
  localStorage.setItem(TABLE_LOG_LINE_LOCALSTORAGE_KEY, value);
}
