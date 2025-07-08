import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AdHocFilterWithLabels } from '@grafana/scenes';

import { LineFilterOp } from './filterTypes';
import { logger } from './logger';

// Synced with grafana/grafana/public/app/features/logs/components/panel/grammar.ts - July 3, 2025
export const logsSyntaxMatches: Record<string, RegExp> = {
  // Levels regex
  'log-token-critical': /(\b)(CRITICAL|CRIT)($|\s)/gi,
  'log-token-debug': /(\b)(DEBUG)($|\s)/gi,
  // Misc log markup regex
  'log-token-duration': /(?:\b)\d+(\.\d+)?(ns|µs|ms|s|m|h|d)(?:\b)/g,
  'log-token-error': /(\b)(ERROR|ERR)($|\s)/gi,
  'log-token-info': /(\b)(INFO)($|\s)/gi,
  'log-token-key': /(\b|\B)[\w_]+(?=\s*=)/gi,

  'log-token-method': /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\b/g,
  'log-token-size': /(?:\b|")\d+\.{0,1}\d*\s*[kKmMGgtTPp]*[bB]{1}(?:"|\b)/g,
  'log-token-trace': /(\b)(TRACE)($|\s)/gi,
  'log-token-uuid': /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g,
  'log-token-warning': /(\b)(WARNING|WARN)($|\s)/gi,

  // JSON values should not contain these
  // 'log-token-string': /"(?!:)([^'"])*?"(?!:)/g,
  // 'log-token-json-key': /"(\b|\B)[\w-]+"(?=\s*:)/gi,
};

export const getLineFilterRegExps = (filters: AdHocFilterWithLabels[]): Array<RegExp | undefined> => {
  return filters
    .filter(
      (search) => (search.operator === LineFilterOp.match || search.operator === LineFilterOp.regex) && search.value
    )
    .map((search) => {
      try {
        if (search.key === 'caseSensitive') {
          return new RegExp(search.value, 'g');
        } else {
          return new RegExp(search.value, 'gi');
        }
      } catch (e) {
        logger.error(e, { msg: 'Error executing match expression', regex: search.value });
        return undefined;
      }
    })
    .filter((f) => f);
};

export type HighlightedValue = Array<React.JSX.Element | string>;

export const mergeStringsAndElements = (valueArray: Array<{ value: string } | string>) => {
  let result: HighlightedValue = [];

  let jsxValues = '';
  let stringValues = '';
  for (let i = 0; i < valueArray.length; i++) {
    const char = valueArray[i];

    // Merge contiguous jsx elements
    if (typeof char === 'string') {
      if (jsxValues) {
        result.push(<mark>{jsxValues}</mark>);
        jsxValues = '';
      }
      stringValues += char;
    } else {
      if (stringValues) {
        result.push(stringValues);
        stringValues = '';
      }
      jsxValues += char.value;
    }
  }

  if (stringValues) {
    result.push(stringValues);
  }
  if (jsxValues) {
    result.push(<mark>{jsxValues}</mark>);
  }
  return result;
};
export const highlightValueStringMatches = (
  matchingIntervals: Array<[number, number]>,
  value: string,
  size: number
) => {
  let valueArray: Array<{ value: string } | string> = [];
  let lineFilterMatchIndex = 0;
  let matchInterval = matchingIntervals[lineFilterMatchIndex];

  // @todo debug why it's only grabbing the first one
  for (let valueIndex = 0; valueIndex < value.length; valueIndex++) {
    // Size is 1 based length, lineFilterMatchIndex is 0 based index
    while (valueIndex >= matchInterval[1] && lineFilterMatchIndex < size - 1) {
      lineFilterMatchIndex++;
      matchInterval = matchingIntervals[lineFilterMatchIndex];
    }
    if (valueIndex >= matchInterval[0] && valueIndex < matchInterval[1]) {
      // this char is part of highlight, return an object in the array so we don't lose the original order, and we can differentiate between highlighted text in the subsequent merge
      valueArray.push({ value: value[valueIndex] });
    } else {
      valueArray.push(value[valueIndex]);
    }
  }

  return mergeStringsAndElements(valueArray);
};

// @todo cache results by regex/value?
export const getLineFilterMatches = (
  matchExpressions: Array<RegExp | undefined>,
  value: string
): Array<[number, number]> => {
  let results: Array<[number, number]> = [];
  matchExpressions.forEach((regex) => {
    let valueMatch;
    let valueMatches = [];
    do {
      try {
        valueMatch = regex?.exec(value);
        if (valueMatch) {
          valueMatches.push(valueMatch);
        }
      } catch (e) {
        logger.error(e, { msg: 'Error executing match expression', regex: regex?.source ?? '' });
      }
    } while (valueMatch);
    if (valueMatches.length) {
      const fromToArray: Array<[number, number]> = valueMatches.map((vm) => [vm.index, vm.index + vm[0].length]);
      results.push(...fromToArray);
    }
  });

  return results;
};

function mergeOverlap(arr: number[][]) {
  // Merge overlapping intervals in-place. We return
  // modified size of the array arr.

  // Sort intervals based on start values
  arr.sort((a, b) => a[0] - b[0]);

  // Index of the last merged
  let resIdx = 0;

  for (let i = 1; i < arr.length; i++) {
    // If current interval overlaps with the
    // last merged interval
    if (arr[resIdx][1] >= arr[i][0]) {
      arr[resIdx][1] = Math.max(arr[resIdx][1], arr[i][1]);
    }
    // Move to the next interval
    else {
      resIdx++;
      arr[resIdx] = arr[i];
    }
  }

  // Returns size of the merged intervals
  return resIdx + 1;
}

export const mergeOverlapping = (matchIndices: number[][]) => {
  if (matchIndices.length) {
    return mergeOverlap(matchIndices);
  }
  return 0;
};

export const getLogsHighlightStyles = (theme: GrafanaTheme2, showHighlight: boolean) => {
  if (!showHighlight) {
    return {};
  }

  // @todo find way to sync/pull from core?
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
