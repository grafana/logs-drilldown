import { type Environment } from './getEnv';
import { type FaroEnvironment } from './getFaroEnv';

export const FARO_ENVIRONMENTS = new Map<Environment, FaroEnvironment>([
  // Uncomment this map entry to test from your local machine
  // [
  //   'local',
  //   {
  //     environment: 'local',
  //     appName: 'grafana-logsdrilldown-app-local',
  //     faroUrl: 'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/54fb57556eb45f8857edb9f0345c0d7a',
  //   },
  // ],
  [
    'dev',
    {
      environment: 'dev',
      appName: 'grafana-logsdrilldown-app-dev',
      faroUrl: 'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/806e0e46ea6dfe306bc7680c0e1bf751',
    },
  ],
  [
    'ops',
    {
      environment: 'ops',
      appName: 'grafana-logsdrilldown-app-ops',
      faroUrl: 'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/c15ae375b5b729200fb584365a13fc7f',
    },
  ],
  [
    'prod',
    {
      environment: 'prod',
      appName: 'grafana-logsdrilldown-app-prod',
      faroUrl: 'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/346c342097ba09fa6fc47d568a2a3243',
    },
  ],
]);
