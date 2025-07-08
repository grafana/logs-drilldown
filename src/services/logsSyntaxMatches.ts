/* eslint sort-keys: 0 */

// Synced with grafana/grafana/public/app/features/logs/components/panel/grammar.ts - July 3, 2025
export const logsSyntaxMatches: Record<string, RegExp> = {
  // Levels regex
  'log-token-critical': /(\b)(CRITICAL|CRIT)($|\s)/gi,
  'log-token-debug': /(\b)(DEBUG)($|\s)/gi,
  'log-token-duration': /\b\d+(\.\d+)?(ns|µs|ms|s|m|h|d)\b/g,
  'log-token-error': /(\b)(ERROR|ERR)($|\s)/gi,
  'log-token-info': /(\b|\B)(INFO)($|\s)/gi,
  // Misc log markup regex
  'log-token-key': /(\b|\B)[\w_]+(?=\s*=)/gi,

  'log-token-method': /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\b/g,
  'log-token-size': /(?:\b|")\d+\.{0,1}\d*\s*[kKmMGgtTPp]*[bB]{1}(?:"|\b)/g,
  'log-token-trace': /(\b)(TRACE)($|\s)/gi,
  'log-token-uuid': /(\b|\B)[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g,
  'log-token-warning': /(\b|\B)(WARNING|WARN)($|\s)/gi,
};
