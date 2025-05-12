import { urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';

import { IndexScene } from '../Components/IndexScene/IndexScene';
import { ServiceScene } from '../Components/ServiceScene/ServiceScene';
import { LineFilterCaseSensitive, LineFilterOp } from './filterTypes';
import { getLineFiltersVariable } from './variableGetters';

function removeEscapeChar(value: string, caseSensitive: boolean) {
  const charsEscapedByEscapeRegExp = ['^', '$', '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|'];
  if (!caseSensitive) {
    charsEscapedByEscapeRegExp.push('\\');
  }
  return value
    .split('')
    .filter((char, index, stringArray) => {
      // We need to differentiate between user entered escape chars, and escape chars added by lodash escapeRegExp to return the same query results in urls from before the line filter regex feature
      // Since there is no reverse of the escapeRegExp method provided by lodash we're essentially building our own "unescapeRegExp"
      const nextChar = stringArray[index + 1];
      const isNextCharRegex = charsEscapedByEscapeRegExp.includes(nextChar);
      return !(char === '\\' && isNextCharRegex);
    })
    .join('');
}

/**
 * Migrates old line filter to new variables
 */
export function migrateLineFilterV1(serviceScene: ServiceScene) {
  const search = urlUtil.getUrlSearchParams();

  const deprecatedLineFilterArray = search['var-lineFilter'];
  if (!Array.isArray(deprecatedLineFilterArray) || !deprecatedLineFilterArray.length) {
    return;
  }
  const deprecatedLineFilter = deprecatedLineFilterArray[0];
  if (typeof deprecatedLineFilter !== 'string' || !deprecatedLineFilter) {
    return;
  }

  const indexScene = sceneGraph.getAncestor(serviceScene, IndexScene);
  const globalLineFilterVars = getLineFiltersVariable(serviceScene);
  const caseSensitiveMatches = deprecatedLineFilter?.match(/\|=.`(.+?)`/);

  if (caseSensitiveMatches && caseSensitiveMatches.length === 2) {
    indexScene.state.body?.state.lineFilterRenderer?.addActivationHandler(() => {
      globalLineFilterVars.setState({
        filters: [
          {
            key: LineFilterCaseSensitive.caseSensitive,
            keyLabel: '0',
            operator: LineFilterOp.match,
            value: removeEscapeChar(caseSensitiveMatches[1], true),
          },
        ],
      });
    });
  }

  const caseInsensitiveMatches = deprecatedLineFilter?.match(/`\(\?i\)(.+)`/);
  if (caseInsensitiveMatches && caseInsensitiveMatches.length === 2) {
    indexScene.state.body?.state.lineFilterRenderer?.addActivationHandler(() => {
      globalLineFilterVars.updateFilters([
        {
          key: LineFilterCaseSensitive.caseInsensitive,
          keyLabel: '0',
          operator: LineFilterOp.match,
          value: removeEscapeChar(caseInsensitiveMatches[1], false),
        },
      ]);
    });
  }
  const location = locationService.getLocation();

  // Remove from url without refreshing
  delete search['var-lineFilter'];
  locationService.replace(urlUtil.renderUrl(location.pathname, search));
}
