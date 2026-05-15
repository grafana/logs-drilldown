import { config, getAppPluginVersion } from '@grafana/runtime';

import packageJson from '../../package.json';
import { getFaro, setFaro } from './faroInstance';
import { getFaroEnvironment } from './getFaroEnv';
import { logger } from 'services/logger';
import { PLUGIN_BASE_URL, PLUGIN_ID } from 'services/plugin';

export { getFaro, setFaro } from './faroInstance';

export const initFaro = async () => {
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
    const pluginVersion = (await getAppPluginVersion(PLUGIN_ID)) ?? packageJson.version;
    const userEmail = config.bootData.user?.email ?? '';

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
      })
    );
    logger.info('Plugin loaded successfully', { pluginId: PLUGIN_ID, appName, environment, pluginVersion });
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error(String(error)), {
      phase: 'initFaro',
    });
  }
};
