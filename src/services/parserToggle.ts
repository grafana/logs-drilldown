import { sceneGraph, SceneQueryRunner, type SceneObject } from '@grafana/scenes';

import { CustomConstantVariable } from './CustomConstantVariable';
import { JSON_PARSER_SEGMENT, LOGFMT_PARSER_SEGMENT, VAR_JSON_PARSER, VAR_LOGFMT_PARSER } from './variables';
import { IndexScene } from 'Components/IndexScene/IndexScene';

// Whether LogQL parsers (`| json ... | logfmt | drop __error__, __error_details__`) are appended to
// queries. Persisted in local storage so the choice is remembered across sessions. Defaults to `true`
// to preserve the previous (always-on) behavior.
export const PARSER_ENABLED_LOCALSTORAGE_KEY = `grafana.explore.logs.parserEnabled`;

export function getParserEnabled(): boolean {
  const stored = localStorage.getItem(PARSER_ENABLED_LOCALSTORAGE_KEY);
  if (stored === null) {
    return true;
  }
  return !(stored === '' || stored === 'false');
}

export function setParserEnabled(enabled: boolean, sceneRef: SceneObject): void {
  localStorage.setItem(PARSER_ENABLED_LOCALSTORAGE_KEY, enabled.toString());
  
  const jsonParserVariable = sceneGraph.lookupVariable(VAR_JSON_PARSER, sceneRef);
  const logfmtParserVariable = sceneGraph.lookupVariable(VAR_LOGFMT_PARSER, sceneRef);
  if (jsonParserVariable instanceof CustomConstantVariable) {
    const segment = getJsonParserSegment(enabled);
    jsonParserVariable.setState({ options: [{ label: segment, value: segment }], text: segment, value: segment });
  }
  if (logfmtParserVariable instanceof CustomConstantVariable) {
    const segment = getLogfmtParserSegment(enabled);
    logfmtParserVariable.setState({ options: [{ label: segment, value: segment }], text: segment, value: segment });
  }

  const indexScene = sceneGraph.getAncestor(sceneRef, IndexScene);

  // Parsed-field, JSON-path and line-format filters require a parser, so remove them when disabling
  // to avoid sending invalid queries.
  if (!enabled) {
    indexScene.clearParserDependentFilters();
  }

  // Re-run every query under the index scene so the new parser setting is applied immediately. Queries
  // built from a fixed expression (e.g. breakdown panels) are re-evaluated against the gate when rebuilt.
  sceneGraph.findDescendents(indexScene, SceneQueryRunner).forEach((queryRunner) => {
    queryRunner.runQueries();
  });
}

/** Value of the `${jsonParser}` variable based on whether parsers are enabled. */
export function getJsonParserSegment(enabled: boolean = getParserEnabled()): string {
  return enabled ? JSON_PARSER_SEGMENT : '';
}

/** Value of the `${logfmtParser}` variable based on whether parsers are enabled. */
export function getLogfmtParserSegment(enabled: boolean = getParserEnabled()): string {
  return enabled ? LOGFMT_PARSER_SEGMENT : '';
}
