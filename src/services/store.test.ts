import { DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { getDefaultDatasourceFromDatasourceSrv } from './store';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
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
