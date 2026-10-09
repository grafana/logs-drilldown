import { DataSourceInstanceListItem } from '@grafana/data';
import { getDataSourceInstanceList, getDefaultDataSourceInstanceListItem } from '@grafana/plugin-compat/datasources';
import { SceneObject } from '@grafana/scenes';

import { isEmbeddedLogs } from './extensions/embedding';
import { getDefaultDatasourceUid, getExpandedLogsView } from './store';
import pluginJson from 'plugin.json';

jest.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstanceList: jest.fn(),
  getDefaultDataSourceInstanceListItem: jest.fn(),
}));

jest.mock('./extensions/embedding', () => ({
  isEmbeddedLogs: jest.fn(),
}));

jest.mock('./logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

function makeDs(overrides: Partial<DataSourceInstanceListItem>): DataSourceInstanceListItem {
  return {
    uid: 'uid',
    name: 'ds',
    type: 'loki',
    ...overrides,
  } as DataSourceInstanceListItem;
}

describe('getDefaultDatasourceUid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDefaultDataSourceInstanceListItem).mockResolvedValue(undefined);
  });

  it('requests only Loki data sources', async () => {
    jest.mocked(getDataSourceInstanceList).mockResolvedValue([]);

    await getDefaultDatasourceUid();

    expect(getDataSourceInstanceList).toHaveBeenCalledWith({ type: 'loki' });
  });

  it('returns the data source marked as default when present', async () => {
    const defaultDs = makeDs({ uid: 'default-uid', name: 'Default Loki' });
    const otherDs = makeDs({ uid: 'other-uid', name: 'grafanacloud-mystack-logs' });
    const items = [otherDs, defaultDs];
    jest.mocked(getDataSourceInstanceList).mockResolvedValue(items);
    jest.mocked(getDefaultDataSourceInstanceListItem).mockResolvedValue(defaultDs);

    await expect(getDefaultDatasourceUid()).resolves.toBe('default-uid');
    expect(getDefaultDataSourceInstanceListItem).toHaveBeenCalledWith(items);
  });

  it('prefers grafanacloud-*-logs by name when no default is set', async () => {
    const firstInList = makeDs({ uid: 'first-uid', name: 'Some Other Loki' });
    const grafanacloudDs = makeDs({ uid: 'grafanacloud-dev-logs', name: 'grafanacloud-dev-logs' });
    jest.mocked(getDataSourceInstanceList).mockResolvedValue([firstInList, grafanacloudDs]);

    await expect(getDefaultDatasourceUid()).resolves.toBe('grafanacloud-dev-logs');
  });

  it('prefers grafanacloud-*-logs by uid when name is different', async () => {
    const firstInList = makeDs({ uid: 'first-uid', name: 'First' });
    const grafanacloudDs = makeDs({ uid: 'grafanacloud-prod-logs', name: 'Grafana Cloud Logs (prod)' });
    jest.mocked(getDataSourceInstanceList).mockResolvedValue([firstInList, grafanacloudDs]);

    await expect(getDefaultDatasourceUid()).resolves.toBe('grafanacloud-prod-logs');
  });

  it('returns first in list when no default and no grafanacloud-*-logs match', async () => {
    const firstDs = makeDs({ uid: 'first-uid', name: 'First Loki' });
    const secondDs = makeDs({ uid: 'second-uid', name: 'Second Loki' });
    jest.mocked(getDataSourceInstanceList).mockResolvedValue([firstDs, secondDs]);

    await expect(getDefaultDatasourceUid()).resolves.toBe('first-uid');
  });

  it('returns undefined when Loki list is empty', async () => {
    jest.mocked(getDataSourceInstanceList).mockResolvedValue([]);

    await expect(getDefaultDatasourceUid()).resolves.toBeUndefined();
  });

  it('does not match grafanacloud-logs without stack name (single dash)', async () => {
    const exactName = makeDs({ uid: 'grafanacloud-logs', name: 'grafanacloud-logs' });
    const withStack = makeDs({ uid: 'grafanacloud-mystack-logs', name: 'grafanacloud-mystack-logs' });
    jest.mocked(getDataSourceInstanceList).mockResolvedValue([exactName, withStack]);

    await expect(getDefaultDatasourceUid()).resolves.toBe('grafanacloud-mystack-logs');
  });

  it('propagates list loading errors', async () => {
    const error = new Error('Failed to load data sources');
    jest.mocked(getDataSourceInstanceList).mockRejectedValue(error);

    await expect(getDefaultDatasourceUid()).rejects.toThrow(error);
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
