import { renderHook, waitFor } from '@testing-library/react';

import { plugin } from '../module';
import {
  getInitialDatasourceUid,
  getInitialDatasourceInfo,
  resolveInitialDatasourceInfo,
  useDefaultDatasourceUid,
} from './initialDatasourceInfo';
import { isKgAnnotationsAvailable } from './kgAnnotations';
import { logger } from './logger';
import { getDefaultDatasourceUid, getLastUsedDataSourceFromStorage } from './store';

jest.mock('../module', () => ({ plugin: { meta: { jsonData: {} } } }));

jest.mock('./kgAnnotations', () => ({
  isKgAnnotationsAvailable: jest.fn(),
}));

jest.mock('./store', () => ({
  getDefaultDatasourceUid: jest.fn(),
  getLastUsedDataSourceFromStorage: jest.fn(),
}));

jest.mock('./logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

describe('resolveInitialDatasourceInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDefaultDatasourceUid).mockResolvedValue('loki-uid');
    jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue(undefined);
    jest.mocked(isKgAnnotationsAvailable).mockResolvedValue(true);
  });

  it('resolves the default datasource and knowledge graph availability for sync readers', async () => {
    await expect(resolveInitialDatasourceInfo()).resolves.toEqual({
      defaultDatasourceUid: 'loki-uid',
      kgAnnotationsAvailable: true,
    });

    expect(getInitialDatasourceInfo()).toEqual({ defaultDatasourceUid: 'loki-uid', kgAnnotationsAvailable: true });
  });

  it('shares one in-flight request between concurrent callers and then starts a new one', async () => {
    await Promise.all([resolveInitialDatasourceInfo(), resolveInitialDatasourceInfo()]);

    expect(getDefaultDatasourceUid).toHaveBeenCalledTimes(1);
    expect(isKgAnnotationsAvailable).toHaveBeenCalledTimes(1);

    await resolveInitialDatasourceInfo();

    expect(getDefaultDatasourceUid).toHaveBeenCalledTimes(2);
  });

  it('skips the default datasource lookup when the caller already knows the datasource', async () => {
    await expect(resolveInitialDatasourceInfo({ needsDefaultDatasource: false })).resolves.toMatchObject({
      kgAnnotationsAvailable: true,
    });

    expect(getDefaultDatasourceUid).not.toHaveBeenCalled();
  });

  it('keeps a resolved default when a concurrent request skipped the lookup', async () => {
    await Promise.all([
      resolveInitialDatasourceInfo(),
      resolveInitialDatasourceInfo({ needsDefaultDatasource: false }),
    ]);

    expect(getInitialDatasourceInfo().defaultDatasourceUid).toBe('loki-uid');
  });

  it('skips the default datasource lookup when a last used datasource is stored', async () => {
    jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue('stored-uid');

    await resolveInitialDatasourceInfo();

    expect(getDefaultDatasourceUid).not.toHaveBeenCalled();
  });

  it('falls back to no default datasource and logs when the lookup fails', async () => {
    const error = new Error('list failed');
    jest.mocked(getDefaultDatasourceUid).mockRejectedValue(error);

    await expect(resolveInitialDatasourceInfo()).resolves.toEqual({
      defaultDatasourceUid: undefined,
      kgAnnotationsAvailable: true,
    });

    expect(logger.error).toHaveBeenCalledWith(error, expect.objectContaining({ msg: expect.any(String) }));
  });

  it('treats the knowledge graph datasource as unavailable when the check fails', async () => {
    jest.mocked(isKgAnnotationsAvailable).mockRejectedValue(new Error('not found'));

    await expect(resolveInitialDatasourceInfo()).resolves.toEqual({
      defaultDatasourceUid: 'loki-uid',
      kgAnnotationsAvailable: false,
    });

    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('getInitialDatasourceUid', () => {
  const setJsonData = (jsonData: object) => Object.assign(plugin.meta, { jsonData });

  beforeEach(async () => {
    jest.clearAllMocks();
    setJsonData({ dataSource: 'settings-uid' });
    jest.mocked(getDefaultDatasourceUid).mockResolvedValue('default-uid');
    jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue(undefined);
    jest.mocked(isKgAnnotationsAvailable).mockResolvedValue(false);
    await resolveInitialDatasourceInfo();
    jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue('last-used-uid');
  });

  afterAll(() => setJsonData({}));

  it('prefers the saved plugin setting', () => {
    expect(getInitialDatasourceUid()).toBe('settings-uid');
  });

  it('then the last used datasource', () => {
    setJsonData({});
    expect(getInitialDatasourceUid()).toBe('last-used-uid');
  });

  it('then the resolved default datasource', () => {
    setJsonData({});
    jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue(undefined);
    expect(getInitialDatasourceUid()).toBe('default-uid');
  });

  it('and finally the fallback when there is no default datasource', async () => {
    setJsonData({});
    jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue(undefined);
    jest.mocked(getDefaultDatasourceUid).mockResolvedValue(undefined);
    await resolveInitialDatasourceInfo();

    expect(getInitialDatasourceUid()).toBe('grafanacloud-logs');
  });
});

describe('useDefaultDatasourceUid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDefaultDatasourceUid).mockResolvedValue('loki-uid');
    jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue(undefined);
    jest.mocked(isKgAnnotationsAvailable).mockResolvedValue(true);
  });

  it('is loading until the default datasource has been resolved', async () => {
    const { result } = renderHook(() => useDefaultDatasourceUid());

    expect(result.current).toEqual({ dsUID: undefined, isLoading: true });

    await waitFor(() => expect(result.current).toEqual({ dsUID: 'loki-uid', isLoading: false }));
  });

  it('skips the default datasource lookup when the uid is already known', async () => {
    const { result } = renderHook(() => useDefaultDatasourceUid('known-uid'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getDefaultDatasourceUid).not.toHaveBeenCalled();
  });

  it('settles without a datasource when the lookup fails', async () => {
    jest.mocked(getDefaultDatasourceUid).mockRejectedValue(new Error('list failed'));

    const { result } = renderHook(() => useDefaultDatasourceUid());

    await waitFor(() => expect(result.current).toEqual({ dsUID: undefined, isLoading: false }));
  });
});

describe('useDefaultDatasourceUid when resolving rejects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDefaultDatasourceUid).mockResolvedValue('loki-uid');
    jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue(undefined);
  });

  it('stops loading and logs instead of staying on the loading state', async () => {
    jest.mocked(isKgAnnotationsAvailable).mockImplementation(() => {
      throw new Error('unexpected failure');
    });

    const { result } = renderHook(() => useDefaultDatasourceUid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(logger.error).toHaveBeenCalledWith(expect.any(Error), {
      msg: 'Failed to resolve the initial datasource',
    });
  });
});

describe('reading before resolution', () => {
  it('returns empty info and warns once', () => {
    jest.isolateModules(() => {
      const fresh = require('./initialDatasourceInfo') as typeof import('./initialDatasourceInfo');

      const freshLogger = (require('./logger') as typeof import('./logger')).logger;

      expect(fresh.getInitialDatasourceInfo()).toEqual({
        defaultDatasourceUid: undefined,
        kgAnnotationsAvailable: false,
      });
      fresh.getInitialDatasourceInfo();

      expect(freshLogger.warn).toHaveBeenCalledTimes(1);
    });
  });
});
