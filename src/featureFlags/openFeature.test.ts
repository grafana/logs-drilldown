import { ClientProviderStatus, OpenFeature, ProviderEvents } from '@openfeature/web-sdk';

import { evaluateFeatureFlag, OPEN_FEATURE_DOMAIN } from './openFeature';

jest.mock('@openfeature/web-sdk', () => ({
  OpenFeature: {
    getClient: jest.fn(),
  },
  ClientProviderStatus: {
    READY: 'READY',
    NOT_READY: 'NOT_READY',
  },
  ProviderEvents: {
    Ready: 'PROVIDER_READY',
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
});
