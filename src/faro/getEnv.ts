export type Environment = 'dev' | 'local' | 'ops' | 'prod';

const MATCHERS: Array<{ environment: Environment; regExp: RegExp }> = [
  {
    regExp: /localhost/,
    environment: 'local',
  },
  {
    regExp: /grafana-dev\.net/,
    environment: 'dev',
  },
  {
    regExp: /grafana-ops\.net/,
    environment: 'ops',
  },
];

/** Exported for unit tests (Jest cannot reliably replace `window.location`). */
export function resolveEnvironmentFromHost(host: string | undefined | null): Environment | null {
  if (host == null || host === '') {
    return null;
  }

  const found = MATCHERS.find(({ regExp }) => regExp.test(host));

  return found ? found.environment : 'prod';
}

export function getEnvironment(): Environment | null {
  return resolveEnvironmentFromHost(window?.location?.host);
}
