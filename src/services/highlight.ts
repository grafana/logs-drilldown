import { GrafanaTheme2 } from '@grafana/data';

// Synced with grafana/grafana/public/app/features/logs/components/panel/grammar.ts - July 3, 2025
export const logsSyntaxMatches: Record<string, RegExp> = {
  // Levels regex
  'log-token-critical': /(\b)(CRITICAL|CRIT)($|\s)/gi,
  'log-token-debug': /(\b)(DEBUG)($|\s)/gi,
  'log-token-duration': /(?:\b)\d+(\.\d+)?(ns|µs|ms|s|m|h|d)(?:\b)/g,
  'log-token-error': /(\b)(ERROR|ERR)($|\s)/gi,
  'log-token-info': /(\b)(INFO)($|\s)/gi,
  'log-token-json-key': /"(\b|\B)[\w-]+"(?=\s*:)/gi,
  'log-token-key': /(\b|\B)[\w_]+(?=\s*=)/gi,
  'log-token-method': /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\b/g,
  'log-token-size': /(?:\b|")\d+\.{0,1}\d*\s*[kKmMGgtTPp]*[bB]{1}(?:"|\b)/g,
  'log-token-string': /"(?!:)([^'"])*?"(?!:)/g,
  'log-token-trace': /(\b)(TRACE)($|\s)/gi,
  'log-token-uuid': /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g,
  'log-token-warning': /(\b)(WARNING|WARN)($|\s)/gi,
};

export const logsHighlightMatches = (searches: string[]) => {
  let matches: Record<string, RegExp> = {};
  if (searches.length) {
    matches['log-token-highlight'] = new RegExp(`(${searches.join('|')})`);
  }
  return matches;
};
export const getLogsHighlightStyles = (theme: GrafanaTheme2, showHighlight: boolean) => {
  if (!showHighlight) {
    return {};
  }

  const colors = {
    critical: '#B877D9',
    debug: '#6E9FFF',
    error: theme.colors.error.text,
    info: '#6CCF8E',
    metadata: theme.colors.text.primary,
    parsedField: theme.colors.text.primary,
    trace: '#6ed0e0',
    warning: '#FBAD37',
  };

  return {
    '.log-search-match': {
      backgroundColor: theme.components.textHighlight.background,
      color: theme.components.textHighlight.text,
    },
    '.log-token-critical': {
      color: colors.critical,
    },
    '.log-token-debug': {
      color: colors.debug,
    },
    '.log-token-duration': {
      color: theme.colors.success.text,
    },
    '.log-token-error': {
      color: colors.error,
    },
    '.log-token-info': {
      color: colors.info,
    },
    '.log-token-json-key': {
      color: colors.parsedField,
      fontWeight: theme.typography.fontWeightMedium,
      opacity: 0.9,
    },
    '.log-token-key': {
      color: colors.parsedField,
      fontWeight: theme.typography.fontWeightMedium,
      opacity: 0.9,
    },
    '.log-token-label': {
      color: colors.metadata,
      fontWeight: theme.typography.fontWeightBold,
    },
    '.log-token-method': {
      color: theme.colors.info.shade,
    },
    '.log-token-size': {
      color: theme.colors.success.text,
    },
    '.log-token-string': {
      // @todo core uses tinycolor().setAlpha(0.75).toRgbString()
      color: theme.colors.text.secondary,
    },
    '.log-token-trace': {
      color: colors.trace,
    },
    '.log-token-uuid': {
      color: theme.colors.success.text,
    },
    '.log-token-warning': {
      color: colors.warning,
    },
  };
};
