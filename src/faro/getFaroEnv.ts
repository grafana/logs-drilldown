import { getEnvironment, type Environment } from './getEnv';

export type FaroEnvironment = { appName: string; environment: Environment; faroUrl: string };

function faroUrlFor(environment: Environment): string {
  switch (environment) {
    case 'local':
      return process.env.FARO_URL_LOCAL ?? '';
    case 'dev':
      return process.env.FARO_URL_DEV ?? '';
    case 'ops':
      return process.env.FARO_URL_OPS ?? '';
    case 'prod':
      return process.env.FARO_URL_PROD ?? '';
    default:
      return '';
  }
}

function appNameFor(environment: Environment): string {
  switch (environment) {
    case 'local':
      return process.env.FARO_APP_NAME_LOCAL || 'grafana-logsdrilldown-app-local';
    case 'dev':
      return process.env.FARO_APP_NAME_DEV || 'grafana-logsdrilldown-app-dev';
    case 'ops':
      return process.env.FARO_APP_NAME_OPS || 'grafana-logsdrilldown-app-ops';
    case 'prod':
      return process.env.FARO_APP_NAME_PROD || 'grafana-logsdrilldown-app-prod';
    default:
      return 'grafana-logsdrilldown-app';
  }
}

export function getFaroEnvironment(): FaroEnvironment | undefined {
  const environment = getEnvironment();

  if (!environment) {
    return undefined;
  }

  const faroUrl = faroUrlFor(environment);
  if (!faroUrl) {
    return undefined;
  }

  return {
    environment,
    faroUrl,
    appName: appNameFor(environment),
  };
}
