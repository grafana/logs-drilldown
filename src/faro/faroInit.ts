import { config } from '@grafana/runtime';

import { getFaro, setFaro } from './faroInstance';
import { getFaroEnvironment } from './getFaroEnv';
import { logger } from 'services/logger';
import packageJson from '../../package.json';
import { PLUGIN_BASE_URL, PLUGIN_ID } from 'services/plugin';

export { getFaro, setFaro } from './faroInstance';

export async function initFaro() {
  if (getFaro()) {
    return;
  }

  const faroEnvironment = getFaroEnvironment();
  if (!faroEnvironment) {
    logger.info('Plugin loaded successfully');
    return;
  }

  try {
    const [{ getWebInstrumentations, initializeFaro }, { TracingInstrumentation }] = await Promise.all([
      import('@grafana/faro-web-sdk'),
      import('@grafana/faro-web-tracing'),
    ]);

    const { environment, faroUrl, appName } = faroEnvironment;
    const { apps, bootData } = config;
    const pluginVersion = apps?.[PLUGIN_ID]?.version ?? packageJson.version;
    const userEmail = bootData.user?.email ?? '';

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
          ...getWebInstrumentations({
            captureConsole: true,
          }),
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
        logger.info('Plugin loaded successfully', { PLUGIN_ID, appName, environment, pluginVersion });
      }
    );
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error(String(error)), {
      phase: 'initFaro',
    });
  }
}
