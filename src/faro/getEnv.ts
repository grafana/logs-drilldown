export type Environment = 'dev' | 'local' | 'ops' | 'prod';

const MATCHERS: Array<{ environment: Environment; regExp: RegExp }> = [
  {
    regExp: /^localhost(:\d+)?$/i,
    environment: 'local',
  },
  {
    regExp: /^127\.0\.0\.1(:\d+)?$/i,
    environment: 'local',
  },
  {
    regExp: /(^|\.)grafana-dev\.net(:\d+)?$/i,
    environment: 'dev',
  },
  {
    regExp: /(^|\.)grafana-ops\.net(:\d+)?$/i,
    environment: 'ops',
  },
  {
    regExp: /(^|\.)grafana\.net(:\d+)?$/i,
    environment: 'prod',
  },
];

/** Exported for unit tests (Jest cannot reliably replace `window.location`). */
export function resolveEnvironmentFromHost(host: string | undefined | null): Environment | null {
  if (host == null || host === '') {
    return null;
  }

  const found = MATCHERS.find(({ regExp }) => regExp.test(host));

  return found ? found.environment : null;
}

export function getEnvironment(): Environment | null {
  return resolveEnvironmentFromHost(window?.location?.host);
}
