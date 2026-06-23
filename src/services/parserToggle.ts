import { JSON_PARSER_SEGMENT, LOGFMT_PARSER_SEGMENT } from './variables';

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

export function setParserEnabled(enabled: boolean): void {
  localStorage.setItem(PARSER_ENABLED_LOCALSTORAGE_KEY, enabled.toString());
}

/** Value of the `${jsonParser}` variable based on whether parsers are enabled. */
export function getJsonParserSegment(enabled: boolean = getParserEnabled()): string {
  return enabled ? JSON_PARSER_SEGMENT : '';
}

/** Value of the `${logfmtParser}` variable based on whether parsers are enabled. */
export function getLogfmtParserSegment(enabled: boolean = getParserEnabled()): string {
  return enabled ? LOGFMT_PARSER_SEGMENT : '';
}
