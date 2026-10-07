import { ClientProviderStatus, MultiProvider, OpenFeature, ProviderEvents } from '@openfeature/web-sdk';

import { createOpenFeatureLocalStorageProvider, createOpenFeatureOFREPWebProvider } from '@grafana/runtime';

import { evaluateFeatureFlag, initOpenFeatureProvider, OPEN_FEATURE_DOMAIN } from './openFeature';

// Mock @grafana/runtime before it loads - it pulls in @openfeature/react-sdk which fails in Jest
jest.mock('@grafana/runtime', () => ({
  config: {
    appSubUrl: '',
    namespace: 'test-namespace',
    openFeatureContext: {},
    featureToggles: {
      exploreLogsAggregatedMetrics: false,
      exploreLogsShardSplitting: false,
      kubernetesLogsDrilldown: false,
      otelLogsFormatting: false,
      queryLibrary: false,
    },
  },
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

describe('evaluateFeatureFlag', () => {
  const getBooleanValue = jest.fn();
  const addHandler = jest.fn();
  const addHooks = jest.fn();
  let clientMock: any;

  beforeEach(() => {
    getBooleanValue.mockReset();
    addHandler.mockReset();
    addHooks.mockReset();

    clientMock = {
      getBooleanValue,
      addHandler,
      addHooks,
      providerStatus: ClientProviderStatus.READY,
    };

    (OpenFeature.getClient as jest.Mock).mockReturnValue(clientMock);
  });

  it('correctly evaluates a boolean flag using the OpenFeature client', async () => {
    // This test verifies that evaluateFeatureFlag correctly delegates to the OpenFeature client
    // and returns the value provided by the client.
    getBooleanValue.mockReturnValue(true);

    // We use a known valid flag for the type check, but the test logic is generic for boolean flags
    const result = await evaluateFeatureFlag('exploreLogsAggregatedMetrics');

    expect(OpenFeature.getClient).toHaveBeenCalledWith(OPEN_FEATURE_DOMAIN);
    expect(addHooks).toHaveBeenCalled(); // Verify hooks are added
    expect(getBooleanValue).toHaveBeenCalledWith('exploreLogsAggregatedMetrics', false); // false is the default in definition
    expect(result).toBe(true);
  });

  it('waits for the OpenFeature client to be ready before evaluating', async () => {
    // This test verifies the "waitForClientReady" wrapper logic
    clientMock.providerStatus = ClientProviderStatus.NOT_READY;
    getBooleanValue.mockReturnValue(true);

    // Simulate event triggering
    addHandler.mockImplementation((event, handler) => {
      if (event === ProviderEvents.Ready) {
        handler(); // Immediately resolve
      }
    });

    await evaluateFeatureFlag('exploreLogsAggregatedMetrics');

    expect(addHandler).toHaveBeenCalledWith(ProviderEvents.Ready, expect.any(Function));
    expect(getBooleanValue).toHaveBeenCalled();
  });

  it('returns the default value from definition when evaluation throws', async () => {
    // This test verifies the error handling wrapper
    getBooleanValue.mockImplementation(() => {
      throw new Error('network');
    });
    // Suppress console.error for this test case
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // false is the default value defined in openFeature.ts for this flag
    await expect(evaluateFeatureFlag('exploreLogsAggregatedMetrics')).resolves.toBe(false);
  });

  it('correctly evaluates exploreLogsShardSplitting flag using the OpenFeature client', async () => {
    getBooleanValue.mockReturnValue(true);

    const result = await evaluateFeatureFlag('exploreLogsShardSplitting');

    expect(getBooleanValue).toHaveBeenCalledWith('exploreLogsShardSplitting', false);
    expect(result).toBe(true);
  });

  it('returns config.featureToggles fallback for exploreLogsShardSplitting when evaluation throws', async () => {
    const { config } = require('@grafana/runtime');
    config.featureToggles.exploreLogsShardSplitting = true;

    getBooleanValue.mockImplementation(() => {
      throw new Error('network');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await evaluateFeatureFlag('exploreLogsShardSplitting');

    expect(result).toBe(true);

    config.featureToggles.exploreLogsShardSplitting = false;
  });

  it('returns config.featureToggles fallback for queryLibrary when evaluation throws', async () => {
    const { config } = require('@grafana/runtime');
    config.featureToggles.queryLibrary = true;

    getBooleanValue.mockImplementation(() => {
      throw new Error('network');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await evaluateFeatureFlag('queryLibrary');

    expect(result).toBe(true);

    config.featureToggles.queryLibrary = false;
  });

  describe('featureToggle override for local dev', () => {
    afterEach(() => {
      const { config } = require('@grafana/runtime');
      delete config.featureToggles.logsVolumeByField;
    });

    it('short-circuits to the enabled dev feature toggle without consulting the OpenFeature client', async () => {
      const { config } = require('@grafana/runtime');
      config.featureToggles.logsVolumeByField = true;

      const result = await evaluateFeatureFlag('drilldown.logs.logsVolumeByField');

      expect(result).toBe(true);
      expect(getBooleanValue).not.toHaveBeenCalled();
    });

    it('short-circuits to the disabled dev feature toggle without consulting the OpenFeature client', async () => {
      const { config } = require('@grafana/runtime');
      config.featureToggles.logsVolumeByField = false;

      const result = await evaluateFeatureFlag('drilldown.logs.logsVolumeByField');

      expect(result).toBe(false);
      expect(getBooleanValue).not.toHaveBeenCalled();
    });

    it('falls through to the OpenFeature client when the dev feature toggle is unset', async () => {
      getBooleanValue.mockReturnValue(true);

      const result = await evaluateFeatureFlag('drilldown.logs.logsVolumeByField');

      expect(getBooleanValue).toHaveBeenCalledWith('drilldown.logs.logsVolumeByField', false);
      expect(result).toBe(true);
    });
  });

  describe('featureToggle override for kgAnnotationsInLokiExplore', () => {
    afterEach(() => {
      const { config } = require('@grafana/runtime');
      delete config.featureToggles.kgAnnotationsInLokiExplore;
    });

    it('short-circuits to the enabled dev feature toggle without consulting the OpenFeature client', async () => {
      const { config } = require('@grafana/runtime');
      config.featureToggles.kgAnnotationsInLokiExplore = true;

      const result = await evaluateFeatureFlag('drilldown.logs.kgAnnotationsInLokiExplore');

      expect(result).toBe(true);
      expect(getBooleanValue).not.toHaveBeenCalled();
    });

    it('falls through to the OpenFeature client when the dev feature toggle is unset', async () => {
      getBooleanValue.mockReturnValue(true);

      const result = await evaluateFeatureFlag('drilldown.logs.kgAnnotationsInLokiExplore');

      expect(getBooleanValue).toHaveBeenCalledWith('drilldown.logs.kgAnnotationsInLokiExplore', false);
      expect(result).toBe(true);
    });
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
