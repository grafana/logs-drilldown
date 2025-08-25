import { getWebInstrumentations, initializeFaro, type Faro } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { config } from '@grafana/runtime';

import { getFaroEnvironment } from './getFaroEnv';
import { logger } from 'services/logger';
import { PLUGIN_BASE_URL, PLUGIN_ID } from 'services/plugin';

let faro: Faro | null = null;

export const getFaro = () => faro;
export const setFaro = (instance: Faro | null, callback?: () => void) => {
  faro = instance;
  if (callback) {
    callback();
  }
};

export function initFaro() {
  if (getFaro()) {
    return;
  }

  const faroEnvironment = getFaroEnvironment();
  if (!faroEnvironment) {
    return;
  }
  const { environment, faroUrl, appName } = faroEnvironment;
  const { apps, bootData } = config;
  const pluginVersion = apps[PLUGIN_ID].version;
  const userEmail = bootData.user.email;

  setFaro(
    initializeFaro({
      url: faroUrl,
      app: {
        name: appName,
        version: pluginVersion,
        environment,
      },
      user: {
        email: userEmail,
      },
      instrumentations: [
        // Mandatory, omits default instrumentations otherwise.
        ...getWebInstrumentations({
          captureConsole: false,
        }),
        // Tracing package to get end-to-end visibility for HTTP requests.
        new TracingInstrumentation(),
      ],
      isolate: true,
      beforeSend: (event) => {
        if ((event.meta.page?.url ?? '').includes(PLUGIN_BASE_URL)) {
          return event;
        }

        return null;
      },
    }),
    () => {
      // Log to affirm successful plugin load, track in deployment tools.
      logger.info('Plugin loaded successfully', { PLUGIN_ID, appName, environment, pluginVersion });
    }
  );
}
