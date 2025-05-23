// Warning: This file (and any imports) are included in the main bundle with Grafana in order to provide link extension support in Grafana core, in an effort to keep Grafana loading quickly, please do not add any unnecessary imports to this file and run the bundle analyzer before committing any changes!

import { LabelType } from './fieldsTypes';
import { ParserType } from './variables';

export type FilterOpType = LabelFilterOp | NumericFilterOp;
export enum LabelFilterOp {
  Equal = '=',
  NotEqual = '!=',
  RegexEqual = '=~',
  RegexNotEqual = '!~',
}
// Line filter doesn't have an operator, so we add an empty space to keep it in URL state
export enum LineFormatFilterOp {
  Empty = ' ',
}

export enum NumericFilterOp {
  gt = '>',
  lt = '<',
  gte = '>=',
  lte = '<=',
}
export const FilterOp = { ...LabelFilterOp, ...NumericFilterOp };

export type IndexedLabelFilter = {
  key: string;
  operator: FilterOpType;
  type?: LabelType;
  value: string;
};

export type FieldFilter = {
  key: string;
  operator: FilterOpType;
  parser?: ParserType;
  type?: LabelType;
  value: string;
};

export type LineFilterType = {
  key: string;
  operator: LineFilterOp;
  value: string;
};

export type PatternFilterType = {
  operator: PatternFilterOp;
  value: string;
};

export enum LineFilterOp {
  match = '|=',
  negativeMatch = `!=`,
  regex = '|~',
  negativeRegex = `!~`,
}

export enum PatternFilterOp {
  match = '|>',
  negativeMatch = '!>',
}

export enum LineFilterCaseSensitive {
  caseSensitive = 'caseSensitive',
  caseInsensitive = 'caseInsensitive',
}
