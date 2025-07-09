import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AdHocFilterWithLabels } from '@grafana/scenes';

import { LineFilterOp } from './filterTypes';
import { logger } from './logger';

export type TextWithHighlightedValue = Array<React.JSX.Element | string>;

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
        logger.info('Error executing match expression', { regex: search.value });
        return undefined;
      }
    })
    .filter((f) => f);
};

const getWrappingElement = (className: string | undefined, jsxValues: string) => {
  if (className) {
    return <span className={className}>{jsxValues}</span>;
  } else {
    return <mark>{jsxValues}</mark>;
  }
};
/**
 *
 * @param valueArray - array of chars to be wrapped
 * @param className - if defined, will wrap matches with span containing this classname instead of <mark> element
 */
export const mergeStringsAndElements = (valueArray: Array<{ value: string } | string>, className?: string) => {
  let result: TextWithHighlightedValue = [];

  let jsxValues = '';
  let stringValues = '';
  for (let i = 0; i < valueArray.length; i++) {
    const char = valueArray[i];

    // Merge contiguous jsx elements
    if (typeof char === 'string') {
      if (jsxValues) {
        result.push(getWrappingElement(className, jsxValues));
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
    result.push(getWrappingElement(className, jsxValues));
  }
  return result;
};
export const highlightValueStringMatches = (
  matchingIntervals: Array<[number, number]>,
  value: string,
  size: number,
  className?: string
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

  return mergeStringsAndElements(valueArray, className);
};

// @todo cache results by regex/value?
export const getMatchingIntervals = (
  matchExpressions: Array<RegExp | undefined>,
  value: string
): Array<[number, number]> => {
  let results: Array<[number, number]> = [];
  matchExpressions.forEach((regex) => {
    let valueMatch: RegExpExecArray | null | undefined;
    let valueMatches: RegExpExecArray[] = [];
    do {
      try {
        valueMatch = regex?.exec(value);
        // Did we match something?
        if (valueMatch) {
          // If we have a valid result
          if (valueMatch[0]) {
            valueMatches.push(valueMatch);
          } else {
            // Otherwise break the loop
            valueMatch = null;
          }
        }
      } catch (e) {
        logger.info('Error executing match expression', { regex: regex?.source ?? '' });
        valueMatch = null;
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
    warning: theme.colors.warning.text,
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
