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
  const getStringValue = jest.fn();
  const addHandler = jest.fn();
  const addHooks = jest.fn();
  let clientMock: any;

  beforeEach(() => {
    getStringValue.mockReset();
    addHandler.mockReset();
    addHooks.mockReset();

    clientMock = {
      getStringValue,
      addHandler,
      addHooks,
      providerStatus: ClientProviderStatus.READY,
    };

    (OpenFeature.getClient as jest.Mock).mockReturnValue(clientMock);
  });

  it('correctly evaluates a string flag using the OpenFeature client', async () => {
    // This test verifies that evaluateFeatureFlag correctly delegates to the OpenFeature client
    // and returns the value provided by the client.
    getStringValue.mockReturnValue('treatment');

    // We use a known valid flag for the type check, but the test logic is generic for string flags
    const result = await evaluateFeatureFlag('drilldown.logs.aggregated_metrics');

    expect(OpenFeature.getClient).toHaveBeenCalledWith(OPEN_FEATURE_DOMAIN);
    expect(addHooks).toHaveBeenCalled(); // Verify hooks are added
    expect(getStringValue).toHaveBeenCalledWith('drilldown.logs.aggregated_metrics', 'excluded'); // 'excluded' is the default in definition
    expect(result).toBe('treatment');
  });

  it('waits for the OpenFeature client to be ready before evaluating', async () => {
    // This test verifies the "waitForClientReady" wrapper logic
    clientMock.providerStatus = ClientProviderStatus.NOT_READY;
    getStringValue.mockReturnValue('treatment');

    // Simulate event triggering
    addHandler.mockImplementation((event, handler) => {
      if (event === ProviderEvents.Ready) {
        handler(); // Immediately resolve
      }
    });

    await evaluateFeatureFlag('drilldown.logs.aggregated_metrics');

    expect(addHandler).toHaveBeenCalledWith(ProviderEvents.Ready, expect.any(Function));
    expect(getStringValue).toHaveBeenCalled();
  });

  it('returns the default value from definition when evaluation throws', async () => {
    // This test verifies the error handling wrapper
    getStringValue.mockImplementation(() => {
      throw new Error('network');
    });
    // Suppress console.error for this test case
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // 'excluded' is the default value defined in openFeature.ts for this flag
    await expect(evaluateFeatureFlag('drilldown.logs.aggregated_metrics')).resolves.toBe('excluded');
  });
});
