import { DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneObject } from '@grafana/scenes';

import pluginJson from '../plugin.json';
import { isEmbeddedLogs } from './extensions/embedding';
import { getDefaultDatasourceFromDatasourceSrv, getExpandedLogsView } from './store';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

jest.mock('./extensions/embedding', () => ({
  isEmbeddedLogs: jest.fn(),
}));

jest.mock('./logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

function makeDs(overrides: Partial<DataSourceInstanceSettings>): DataSourceInstanceSettings {
  return {
    uid: 'uid',
    id: 1,
    name: 'ds',
    type: 'loki',
    isDefault: false,
    readOnly: false,
    jsonData: {},
    access: 'proxy',
    ...overrides,
  } as DataSourceInstanceSettings;
}

describe('getDefaultDatasourceFromDatasourceSrv', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the data source marked as default when present', () => {
    const defaultDs = makeDs({ uid: 'default-uid', name: 'Default Loki', isDefault: true });
    const otherDs = makeDs({ uid: 'other-uid', name: 'grafanacloud-mystack-logs', isDefault: false });
    jest.mocked(getDataSourceSrv).mockReturnValue({
      getList: () => [otherDs, defaultDs],
    } as any);

    expect(getDefaultDatasourceFromDatasourceSrv()).toBe('default-uid');
  });

  it('prefers grafanacloud-*-logs by name when no default is set', () => {
    const firstInList = makeDs({ uid: 'first-uid', name: 'Some Other Loki' });
    const grafanacloudDs = makeDs({
      uid: 'grafanacloud-dev-logs',
      name: 'grafanacloud-dev-logs',
      isDefault: false,
    });
    jest.mocked(getDataSourceSrv).mockReturnValue({
      getList: () => [firstInList, grafanacloudDs],
    } as any);

    expect(getDefaultDatasourceFromDatasourceSrv()).toBe('grafanacloud-dev-logs');
  });

  it('prefers grafanacloud-*-logs by uid when name is different', () => {
    const firstInList = makeDs({ uid: 'first-uid', name: 'First' });
    const grafanacloudDs = makeDs({
      uid: 'grafanacloud-prod-logs',
      name: 'Grafana Cloud Logs (prod)',
      isDefault: false,
    });
    jest.mocked(getDataSourceSrv).mockReturnValue({
      getList: () => [firstInList, grafanacloudDs],
    } as any);

    expect(getDefaultDatasourceFromDatasourceSrv()).toBe('grafanacloud-prod-logs');
  });

  it('returns first in list when no default and no grafanacloud-*-logs match', () => {
    const firstDs = makeDs({ uid: 'first-uid', name: 'First Loki' });
    const secondDs = makeDs({ uid: 'second-uid', name: 'Second Loki' });
    jest.mocked(getDataSourceSrv).mockReturnValue({
      getList: () => [firstDs, secondDs],
    } as any);

    expect(getDefaultDatasourceFromDatasourceSrv()).toBe('first-uid');
  });

  it('returns undefined when Loki list is empty', () => {
    jest.mocked(getDataSourceSrv).mockReturnValue({
      getList: () => [],
    } as any);

    expect(getDefaultDatasourceFromDatasourceSrv()).toBeUndefined();
  });

  it('does not match grafanacloud-logs without stack name (single dash)', () => {
    const exactName = makeDs({ uid: 'grafanacloud-logs', name: 'grafanacloud-logs', isDefault: false });
    const withStack = makeDs({
      uid: 'grafanacloud-mystack-logs',
      name: 'grafanacloud-mystack-logs',
      isDefault: false,
    });
    jest.mocked(getDataSourceSrv).mockReturnValue({
      getList: () => [exactName, withStack],
    } as any);

    expect(getDefaultDatasourceFromDatasourceSrv()).toBe('grafanacloud-mystack-logs');
  });
});

describe('getExpandedLogsView', () => {
  // isEmbeddedLogs walks the scene graph, so mock its result. Everything else uses real localStorage (jsdom).
  const sceneRef = {} as SceneObject;
  const NON_EMBEDDED_KEY = `${pluginJson.id}.logs.expanded`;
  const EMBEDDED_KEY = `${pluginJson.id}.logs.embedded.expanded`;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('when not embedded', () => {
    beforeEach(() => jest.mocked(isEmbeddedLogs).mockReturnValue(false));

    it('returns false when nothing is stored', () => {
      expect(getExpandedLogsView(sceneRef)).toBe(false);
    });

    it('returns true when stored value is "true"', () => {
      localStorage.setItem(NON_EMBEDDED_KEY, 'true');
      expect(getExpandedLogsView(sceneRef)).toBe(true);
    });

    it('returns false when stored value is "false"', () => {
      localStorage.setItem(NON_EMBEDDED_KEY, 'false');
      expect(getExpandedLogsView(sceneRef)).toBe(false);
    });

    it('returns false the stored value is not valid JSON', () => {
      localStorage.setItem(NON_EMBEDDED_KEY, 'not-json');
      expect(getExpandedLogsView(sceneRef)).toBe(false);
    });
  });

  describe('when embedded', () => {
    beforeEach(() => jest.mocked(isEmbeddedLogs).mockReturnValue(true));

    it('defaults to true when nothing is stored', () => {
      expect(getExpandedLogsView(sceneRef)).toBe(true);
    });

    it('respects a stored "false" preference over the embedded default', () => {
      localStorage.setItem(EMBEDDED_KEY, 'false');
      expect(getExpandedLogsView(sceneRef)).toBe(false);
    });

    it('respects a stored "true" preference over the embedded default', () => {
      localStorage.setItem(EMBEDDED_KEY, 'true');
      expect(getExpandedLogsView(sceneRef)).toBe(true);
    });
  });
});
