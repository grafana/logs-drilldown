import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';

import { initFaro, setFaro } from '../faroInit';

// Faro dependencies
jest.mock('@grafana/faro-web-sdk');

// Grafana dependency
jest.mock('@grafana/runtime', () => ({
  config: {
    apps: {
      'grafana-lokiexplore-app': {
        version: '1.0.0',
      },
    },
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
}));

function setup(location: Partial<Location>) {
  (initializeFaro as jest.Mock).mockReturnValue({});
  (getWebInstrumentations as jest.Mock).mockReturnValue([{}]);

  Object.defineProperty(window, 'location', {
    value: location,
    writable: true,
  });

  return {
    initializeFaro: initializeFaro as jest.Mock,
  };
}

describe('initFaro()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setFaro(null);
  });

  afterEach(() => {
    setFaro(null);
  });

  describe('when running in environment where the host not defined', () => {
    test('does not initialize Faro', () => {
      const { initializeFaro } = setup({ host: undefined });

      initFaro();

      expect(initializeFaro).not.toHaveBeenCalled();
    });
  });

  describe('when running in an unknown environment', () => {
    test('does not initialize Faro', () => {
      const { initializeFaro } = setup({ host: 'unknownhost' });

      initFaro();

      expect(initializeFaro).not.toHaveBeenCalled();
    });
  });

  describe('when running in an known environment', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      setFaro(null);
    });

    test.each([
      // dev
      [
        'grafana-dev.net',
        'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/806e0e46ea6dfe306bc7680c0e1bf751',
        'grafana-logsdrilldown-app-dev',
      ],
      [
        'test.grafana-dev.net',
        'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/806e0e46ea6dfe306bc7680c0e1bf751',
        'grafana-logsdrilldown-app-dev',
      ],
      // ops
      [
        'foobar.grafana-ops.net',
        'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/c15ae375b5b729200fb584365a13fc7f',
        'grafana-logsdrilldown-app-ops',
      ],
      [
        'grafana-ops.net',
        'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/c15ae375b5b729200fb584365a13fc7f',
        'grafana-logsdrilldown-app-ops',
      ],
      // prod
      [
        'foobar.grafana.net',
        'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/346c342097ba09fa6fc47d568a2a3243',
        'grafana-logsdrilldown-app-prod',
      ],
      [
        'grafana.net',
        'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/346c342097ba09fa6fc47d568a2a3243',
        'grafana-logsdrilldown-app-prod',
      ],
    ])('initializes Faro for the host "%s"', (host, faroUrl, appName) => {
      const { initializeFaro } = setup({ host });

      // Reset mock call count for this specific test
      (initializeFaro as jest.Mock).mockClear();

      initFaro();

      expect(initializeFaro).toHaveBeenCalledTimes(1);
      expect(initializeFaro.mock.lastCall[0].url).toBe(faroUrl);
      expect(initializeFaro.mock.lastCall[0].app.name).toBe(appName);
    });

    test('initializes Faro with the proper configuration', () => {
      const { initializeFaro } = setup({ host: 'grafana.net' });

      initFaro();

      const { app, user, instrumentations, isolate, beforeSend } = initializeFaro.mock.lastCall[0];

      expect(app).toStrictEqual({
        name: 'grafana-logsdrilldown-app-prod',
        version: '1.0.0',
        environment: 'prod',
      });

      expect(user).toStrictEqual({ email: 'sixty.four@grafana.com' });

      expect(getWebInstrumentations).toHaveBeenCalledWith({
        captureConsole: false,
      });
      expect(instrumentations).toBeInstanceOf(Array);
      expect(instrumentations.length).toBe(2);

      expect(isolate).toBe(true);
      expect(beforeSend).toBeInstanceOf(Function);
    });
  });

  describe('when called several times', () => {
    test('initializes Faro only once', () => {
      const { initializeFaro } = setup({ host: 'grafana.net' });

      initFaro();
      initFaro();

      expect(initializeFaro).toHaveBeenCalledTimes(1);
    });
  });
});
