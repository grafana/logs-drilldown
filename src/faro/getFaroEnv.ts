import { FARO_ENVIRONMENTS } from './faroEnv';
import { getEnvironment, type Environment } from './getEnv';

export type FaroEnvironment = { appName: string; environment: Environment; faroUrl: string };

export function getFaroEnvironment() {
  const environment = getEnvironment();

  if (!environment || !FARO_ENVIRONMENTS.has(environment)) {
    return;
  }

  return FARO_ENVIRONMENTS.get(environment) as FaroEnvironment;
}
