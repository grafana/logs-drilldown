import { SceneObjectUrlValues } from '@grafana/scenes';

import { EMBEDDED_VARIABLE_NAMESPACE } from './variables';

const VARIABLE_PREFIX = 'var-';

/**
 * To be called when building links from embedded to non-embedded contexts
 * e.g. whenever we call sceneUtils.getUrlState in embedded component
 * @todo _urlSync keys
 * @param vars
 */
export function removeUrlParamNamespaces(vars: SceneObjectUrlValues): SceneObjectUrlValues {
  const mapped: SceneObjectUrlValues = {};
  Object.keys(vars).forEach((key) => {
    // @todo this could be more robust, it's probably safe to assume we don't have any variable names that contain the prefix
    // but it would be better for scenes to be able to undo the prefixing so we don't need to make changes if that implementation changes.
    const mappedKey = key.replace(`${VARIABLE_PREFIX}${EMBEDDED_VARIABLE_NAMESPACE}-`, VARIABLE_PREFIX);
    mapped[mappedKey] = vars[key];
  });

  return mapped;
}
