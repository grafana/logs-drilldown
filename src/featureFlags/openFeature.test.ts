import { MultiProvider, OpenFeature } from '@openfeature/web-sdk';

import { createOpenFeatureLocalStorageProvider, createOpenFeatureOFREPWebProvider } from '@grafana/runtime';

import { getFeatureFlag, initOpenFeatureProvider, OPEN_FEATURE_DOMAIN } from './openFeature';

// Mock @grafana/runtime before it loads - it pulls in @openfeature/react-sdk which fails in Jest
jest.mock('@grafana/runtime', () => ({
  createOpenFeatureLocalStorageProvider: jest.fn(),
  createOpenFeatureOFREPWebProvider: jest.fn(),
}));

jest.mock('@openfeature/web-sdk', () => ({
  OpenFeature: {
    getClient: jest.fn(),
    getProvider: jest.fn(),
    setProviderAndWait: jest.fn().mockResolvedValue(undefined),
  },
  MultiProvider: jest.fn().mockImplementation((providers) => ({ providers })),
  ClientProviderStatus: {
    READY: 'READY',
    NOT_READY: 'NOT_READY',
    ERROR: 'ERROR',
    FATAL: 'FATAL',
  },
  ProviderEvents: {
    Ready: 'PROVIDER_READY',
    Error: 'PROVIDER_ERROR',
  },
}));

// Mock the tracking hook module since it's used in the function under test
jest.mock('./tracking', () => ({
  TrackingHook: jest.fn().mockImplementation(() => ({})),
}));

describe('getFeatureFlag', () => {
  const getBooleanValue = jest.fn();
  const addHooks = jest.fn();

  beforeEach(() => {
    getBooleanValue.mockReset();
    addHooks.mockReset();
    (OpenFeature.getClient as jest.Mock).mockClear();

    (OpenFeature.getClient as jest.Mock).mockImplementation(() => ({
      getBooleanValue,
      addHooks,
    }));
  });

  it('evaluates a boolean flag using the OpenFeature client', () => {
    getBooleanValue.mockReturnValue(true);

    const result = getFeatureFlag('exploreLogsAggregatedMetrics');

    expect(OpenFeature.getClient).toHaveBeenCalledWith(OPEN_FEATURE_DOMAIN);
    expect(addHooks).toHaveBeenCalledTimes(1);
    expect(getBooleanValue).toHaveBeenCalledWith('exploreLogsAggregatedMetrics', false);
    expect(result).toBe(true);
  });

  it('uses the client evaluation method default when the provider is not ready', () => {
    getBooleanValue.mockImplementation((_flagName, defaultValue) => defaultValue);

    const result = getFeatureFlag('exploreLogsAggregatedMetrics');

    expect(getBooleanValue).toHaveBeenCalledWith('exploreLogsAggregatedMetrics', false);
    expect(result).toBe(false);
  });

  it('adds the tracking hook to each client returned by OpenFeature', () => {
    getBooleanValue.mockReturnValue(true);

    getFeatureFlag('exploreLogsShardSplitting');
    getFeatureFlag('exploreLogsShardSplitting');

    expect(OpenFeature.getClient).toHaveBeenCalledTimes(2);
    expect(addHooks).toHaveBeenCalledTimes(2);
  });
});

describe('initOpenFeatureProvider', () => {
  const defaultProvider = {};

  beforeEach(() => {
    (OpenFeature.setProviderAndWait as jest.Mock).mockClear();
    (OpenFeature.getProvider as jest.Mock).mockReturnValue(defaultProvider);
    (MultiProvider as jest.Mock).mockClear();

    (createOpenFeatureLocalStorageProvider as jest.Mock).mockReset();
    (createOpenFeatureOFREPWebProvider as jest.Mock).mockReset();
  });

  it('initializes a MultiProvider with Grafana shared providers', async () => {
    const localStorageProvider = { name: 'local-storage' };
    const ofrepProvider = { name: 'ofrep' };
    (createOpenFeatureLocalStorageProvider as jest.Mock).mockReturnValue(localStorageProvider);
    (createOpenFeatureOFREPWebProvider as jest.Mock).mockReturnValue(ofrepProvider);

    await initOpenFeatureProvider();

    expect(createOpenFeatureLocalStorageProvider).toHaveBeenCalledTimes(1);
    expect(createOpenFeatureOFREPWebProvider).toHaveBeenCalledTimes(1);
    expect(MultiProvider).toHaveBeenCalledWith([{ provider: localStorageProvider }, { provider: ofrepProvider }]);
    expect(OpenFeature.setProviderAndWait).toHaveBeenCalledWith(OPEN_FEATURE_DOMAIN, {
      providers: [{ provider: localStorageProvider }, { provider: ofrepProvider }],
    });
  });
});
