import { chooseDatasourceUid, getInitialDatasourceInfo, resolveInitialDatasourceInfo } from './initialDatasourceInfo';
import { isKgAnnotationsAvailable } from './kgAnnotations';
import { logger } from './logger';
import { getDefaultDatasourceUid, getLastUsedDataSourceFromStorage } from './store';

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
    await expect(resolveInitialDatasourceInfo({ needsDefaultDatasource: false })).resolves.toEqual({
      defaultDatasourceUid: undefined,
      kgAnnotationsAvailable: true,
    });

    expect(getDefaultDatasourceUid).not.toHaveBeenCalled();
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

describe('chooseDatasourceUid', () => {
  const all = {
    fallback: 'fallback-uid',
    lastUsed: 'last-used-uid',
    pluginSettings: 'settings-uid',
    state: 'state-uid',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.mocked(getDefaultDatasourceUid).mockResolvedValue('default-uid');
    jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue(undefined);
    jest.mocked(isKgAnnotationsAvailable).mockResolvedValue(false);
    await resolveInitialDatasourceInfo();
  });

  it('prefers explicit scene state over every other source', () => {
    expect(chooseDatasourceUid(all)).toBe('state-uid');
  });

  it('then the saved plugin setting', () => {
    expect(chooseDatasourceUid({ ...all, state: undefined })).toBe('settings-uid');
  });

  it('then the last used datasource', () => {
    expect(chooseDatasourceUid({ ...all, state: undefined, pluginSettings: undefined })).toBe('last-used-uid');
  });

  it('then the resolved default datasource', () => {
    expect(chooseDatasourceUid({ fallback: 'fallback-uid' })).toBe('default-uid');
  });

  it('and finally the fallback when there is no default datasource', async () => {
    jest.mocked(getDefaultDatasourceUid).mockResolvedValue(undefined);
    await resolveInitialDatasourceInfo();

    expect(chooseDatasourceUid({ fallback: 'fallback-uid' })).toBe('fallback-uid');
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
