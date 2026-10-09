import { renderHook, waitFor } from '@testing-library/react';

import { useConfigDatasourceUid } from './useConfigDatasourceUid';
import { logger } from 'services/logger';
import { getDefaultDatasourceUid, getLastUsedDataSourceFromStorage } from 'services/store';

jest.mock('services/store', () => ({
  getDefaultDatasourceUid: jest.fn(),
  getLastUsedDataSourceFromStorage: jest.fn(),
}));

jest.mock('services/logger', () => ({
  logger: { error: jest.fn() },
}));

describe('useConfigDatasourceUid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue(undefined);
    jest.mocked(getDefaultDatasourceUid).mockResolvedValue('default-uid');
  });

  it('uses the last used datasource immediately and skips the default lookup', () => {
    jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue('stored-uid');

    const { result } = renderHook(() => useConfigDatasourceUid());

    expect(result.current).toEqual({ dsUID: 'stored-uid', isLoading: false });
    expect(getDefaultDatasourceUid).not.toHaveBeenCalled();
  });

  it('is loading until the default datasource has been resolved', async () => {
    const { result } = renderHook(() => useConfigDatasourceUid());

    expect(result.current).toEqual({ dsUID: undefined, isLoading: true });

    await waitFor(() => expect(result.current).toEqual({ dsUID: 'default-uid', isLoading: false }));
  });

  it('settles without a datasource when there is no default', async () => {
    jest.mocked(getDefaultDatasourceUid).mockResolvedValue(undefined);

    const { result } = renderHook(() => useConfigDatasourceUid());

    await waitFor(() => expect(result.current).toEqual({ dsUID: undefined, isLoading: false }));
  });

  it('settles without a datasource and logs when the lookup fails', async () => {
    const error = new Error('list failed');
    jest.mocked(getDefaultDatasourceUid).mockRejectedValue(error);

    const { result } = renderHook(() => useConfigDatasourceUid());

    await waitFor(() => expect(result.current).toEqual({ dsUID: undefined, isLoading: false }));
    expect(logger.error).toHaveBeenCalledWith(error, expect.objectContaining({ msg: expect.any(String) }));
  });
});
