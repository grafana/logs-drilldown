import { LogsSortOrder, RawTimeRange, UrlQueryMap } from '@grafana/data';

import { drilldownLabelUrlKey, pageSlugUrlKey } from '../Components/ServiceScene/ServiceScene';
import { SelectedTableRow } from '../Components/Table/LogLineCellComponent';
import { PageSlugs, TabNames, ValueSlugs } from './enums';
import { LabelFilterOp, NumericFilterOp } from './filterTypes';
import { LogsVisualizationType } from './store';
import { FieldValue, ParserType } from './variables';

const isObj = (o: unknown): o is object => typeof o === 'object' && o !== null;

export function hasProp<K extends PropertyKey>(data: object, prop: K): data is Record<K, unknown> {
  return prop in data;
}

const isString = (s: unknown) => (typeof s === 'string' && s) || '';

export const isRecord = (obj: unknown): obj is Record<string, unknown> => typeof obj === 'object';

export function unknownToStrings(a: unknown): string[] {
  let strings: string[] = [];
  if (Array.isArray(a)) {
    for (let i = 0; i < a.length; i++) {
      strings.push(isString(a[i]));
    }
  }
  return strings;
}

export function narrowSelectedTableRow(o: unknown): SelectedTableRow | false {
  const narrowed = isObj(o) && hasProp(o, 'row') && hasProp(o, 'id') && o;

  if (narrowed) {
    const row = typeof narrowed.row === 'number' && narrowed.row;
    const id = typeof narrowed.id === 'string' && narrowed.id;
    if (id !== false && row !== false) {
      return { id, row };
    }
  }

  return false;
}

export function narrowLogsVisualizationType(o: unknown): LogsVisualizationType | false {
  return typeof o === 'string' && (o === 'logs' || o === 'table') && o;
}
export function narrowLogsSortOrder(o: unknown): LogsSortOrder | false {
  if (typeof o === 'string' && o === LogsSortOrder.Ascending.toString()) {
    return LogsSortOrder.Ascending;
  }

  if (typeof o === 'string' && o === LogsSortOrder.Descending.toString()) {
    return LogsSortOrder.Descending;
  }

  return false;
}

export function narrowFieldValue(o: unknown): FieldValue | false {
  const narrowed = isObj(o) && hasProp(o, 'value') && hasProp(o, 'parser') && o;

  if (narrowed) {
    const parser: ParserType | false =
      typeof narrowed.parser === 'string' &&
      (narrowed.parser === 'logfmt' ||
        narrowed.parser === 'json' ||
        narrowed.parser === 'mixed' ||
        narrowed.parser === 'structuredMetadata') &&
      narrowed.parser;
    const value = typeof narrowed.value === 'string' && narrowed.value;

    if (parser !== false && value !== false) {
      return { parser, value };
    }
  }

  return false;
}

export function narrowRecordStringNumber(o: unknown): Record<string, number> | false {
  const narrowed = isObj(o) && isRecord(o) && o;

  if (narrowed) {
    const keys = Object.keys(narrowed);
    const returnRecord: Record<string, number> = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = narrowed[keys[i]];
      if (typeof value === 'number') {
        returnRecord[key] = value;
      }
    }

    return returnRecord;
  }

  return false;
}

export function narrowTimeRange(unknownRange: unknown): RawTimeRange | undefined {
  const range = isObj(unknownRange) && hasProp(unknownRange, 'to') && hasProp(unknownRange, 'from') && unknownRange;
  if (range) {
    const to = isString(range.to);
    const from = isString(range.from);
    if (to && from) {
      return { from, to };
    }
  }

  return undefined;
}

export function narrowErrorMessage(e: unknown): string | undefined {
  const msg = isObj(e) && hasProp(e, 'error') && isString(e.error);
  if (msg) {
    return msg;
  }
  return undefined;
}

export function narrowFilterOperator(op: string): LabelFilterOp | NumericFilterOp {
  switch (op) {
    case LabelFilterOp.Equal:
    case LabelFilterOp.NotEqual:
    case LabelFilterOp.RegexEqual:
    case LabelFilterOp.RegexNotEqual:
    case NumericFilterOp.gt:
    case NumericFilterOp.gte:
    case NumericFilterOp.lt:
    case NumericFilterOp.lte:
      return op;
    default:
      throw new NarrowingError('operator is invalid!');
  }
}

export function narrowTabName(input: unknown): TabNames | false {
  return (
    (input === TabNames.fields ||
      input === TabNames.labels ||
      input === TabNames.logs ||
      input === TabNames.patterns) &&
    input
  );
}

export function narrowPageOrValueSlug(input: unknown): ValueSlugs | PageSlugs | false {
  return narrowPageSlug(input) || narrowValueSlug(input);
}

export function narrowValueSlug(input: unknown): ValueSlugs | false {
  return (input === ValueSlugs.field || input === ValueSlugs.label) && input;
}

export function narrowPageSlug(input: unknown): PageSlugs | false {
  if (typeof input === 'string') {
    input = input.toLowerCase();
  }
  return (
    (input === PageSlugs.fields ||
      input === PageSlugs.labels ||
      input === PageSlugs.logs ||
      input === PageSlugs.patterns) &&
    input
  );
}

export function narrowDrilldownLabelFromSearchParams(searchParams: UrlQueryMap) {
  return Array.isArray(searchParams[drilldownLabelUrlKey]) &&
    searchParams[drilldownLabelUrlKey][0] &&
    typeof searchParams[drilldownLabelUrlKey][0] === 'string'
    ? searchParams[drilldownLabelUrlKey][0]
    : typeof searchParams[drilldownLabelUrlKey] === 'string' && searchParams[drilldownLabelUrlKey];
}

export function narrowPageSlugFromSearchParams(searchParams: UrlQueryMap) {
  return narrowPageOrValueSlug(
    Array.isArray(searchParams[pageSlugUrlKey]) ? searchParams[pageSlugUrlKey][0] : searchParams[pageSlugUrlKey]
  );
}

export class NarrowingError extends Error {}
