import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';

import { initFaro, setFaro } from '../faroInit';
import { getFaroEnvironment } from '../getFaroEnv';

jest.mock('../getFaroEnv');
jest.mock('@grafana/faro-web-sdk');
jest.mock('@grafana/faro-web-tracing');

jest.mock('@grafana/runtime', () => ({
  config: {
    bootData: {
      user: {
        email: 'sixty.four@grafana.com',
      },
    },
    buildInfo: {
      version: '11.6.0',
      edition: 'Enterprise',
    },
  },
  getAppPluginVersion: jest.fn().mockResolvedValue('1.0.0'),
}));

const mockedGetFaroEnvironment = getFaroEnvironment as jest.MockedFunction<typeof getFaroEnvironment>;
const initializeFaroMock = initializeFaro as jest.MockedFunction<typeof initializeFaro>;
const getWebInstrumentationsMock = getWebInstrumentations as jest.MockedFunction<typeof getWebInstrumentations>;

const DEV_URL = 'https://example.com/collect-dev';
const OPS_URL = 'https://example.com/collect-ops';
const PROD_URL = 'https://example.com/collect-prod';

describe('initFaro()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setFaro(null);
    initializeFaroMock.mockReturnValue({} as ReturnType<typeof initializeFaro>);
    getWebInstrumentationsMock.mockReturnValue([{} as never]);
  });

  afterEach(() => {
    setFaro(null);
  });

  describe('when Faro is not configured for this deployment', () => {
    test('does not initialize Faro', async () => {
      mockedGetFaroEnvironment.mockReturnValue(undefined);

      await initFaro();

      expect(initializeFaro).not.toHaveBeenCalled();
    });
  });

  describe('when Faro environment is available', () => {
    test.each([
      ['dev', DEV_URL, 'grafana-logsdrilldown-app-dev'],
      ['ops', OPS_URL, 'grafana-logsdrilldown-app-ops'],
      ['prod', PROD_URL, 'grafana-logsdrilldown-app-prod'],
    ])('initializes Faro for %s', async (environment, faroUrl, appName) => {
      mockedGetFaroEnvironment.mockReturnValue({
        environment: environment as 'dev' | 'ops' | 'prod',
        faroUrl,
        appName,
      });

      await initFaro();

      expect(initializeFaro).toHaveBeenCalledTimes(1);
      expect(initializeFaroMock.mock.lastCall?.[0].url).toBe(faroUrl);
      expect(initializeFaroMock.mock.lastCall?.[0].app.name).toBe(appName);
    });

    test('initializes Faro with the proper configuration', async () => {
      mockedGetFaroEnvironment.mockReturnValue({
        environment: 'prod',
        faroUrl: PROD_URL,
        appName: 'grafana-logsdrilldown-app-prod',
      });

      await initFaro();

      const lastCall = initializeFaroMock.mock.lastCall;
      if (lastCall == null) {
        throw new Error('expected initializeFaro to have been called');
      }
      const { app, user, instrumentations, isolate, beforeSend } = lastCall[0];

      expect(app).toStrictEqual({
        name: 'grafana-logsdrilldown-app-prod',
        version: '1.0.0',
        environment: 'prod',
      });

      expect(user).toStrictEqual({ email: 'sixty.four@grafana.com' });

      expect(getWebInstrumentations).toHaveBeenCalledWith({
        captureConsole: true,
      });
      expect(instrumentations).toBeInstanceOf(Array);
      if (!Array.isArray(instrumentations)) {
        throw new Error('expected instrumentations array');
      }
      expect(instrumentations.length).toBe(2);

      expect(isolate).toBe(true);
      expect(beforeSend).toBeInstanceOf(Function);
    });
  });

  describe('when called several times', () => {
    test('initializes Faro only once', async () => {
      mockedGetFaroEnvironment.mockReturnValue({
        environment: 'prod',
        faroUrl: PROD_URL,
        appName: 'grafana-logsdrilldown-app-prod',
      });

      await initFaro();
      await initFaro();

      expect(initializeFaro).toHaveBeenCalledTimes(1);
    });
  });
});
