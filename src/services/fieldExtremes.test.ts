import { createDataFrame, FieldType } from '@grafana/data';

import {
  DETECTED_FIELDS_CARDINALITY_NAME,
  DETECTED_FIELDS_NAME_FIELD,
  DETECTED_FIELDS_PARSER_NAME,
  DETECTED_FIELDS_TYPE_NAME,
} from './datasource';
import { findExtremePoint, getFieldNames, getFieldOptions } from './fieldExtremes';
import { getParserEnabled } from './parserToggle';

jest.mock('./parserToggle', () => ({
  getParserEnabled: jest.fn(() => true),
}));

const series = [
  createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1, 2, 3, 4] },
      { name: 'value', type: FieldType.number, values: [3, null, 9, 1] },
    ],
  }),
  createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [5, 6] },
      { name: 'value', type: FieldType.number, values: [12, NaN] },
    ],
  }),
];

describe('findExtremePoint', () => {
  it('finds the highest value and when it happened across frames', () => {
    expect(findExtremePoint(series, 'max')).toEqual({ time: 5, value: 12 });
  });

  it('finds the lowest value and skips missing values', () => {
    expect(findExtremePoint(series, 'min')).toEqual({ time: 4, value: 1 });
  });

  it('returns undefined without numeric values', () => {
    expect(findExtremePoint([], 'max')).toBeUndefined();
  });
});

const detectedFields = [
  { name: 'caller', parser: 'logfmt', type: 'string' },
  { name: 'ok', parser: 'logfmt', type: 'boolean' },
  { name: 'status', parser: 'json', type: 'int' },
  { name: 'latency', parser: 'logfmt', type: 'duration' },
  { name: 'size', parser: 'structuredMetadata', type: 'bytes' },
];

const frame = createDataFrame({
  fields: [
    { name: DETECTED_FIELDS_NAME_FIELD, type: FieldType.string, values: detectedFields.map((f) => f.name) },
    { name: DETECTED_FIELDS_CARDINALITY_NAME, type: FieldType.number, values: detectedFields.map(() => 4) },
    { name: DETECTED_FIELDS_PARSER_NAME, type: FieldType.string, values: detectedFields.map((f) => f.parser) },
    { name: DETECTED_FIELDS_TYPE_NAME, type: FieldType.string, values: detectedFields.map((f) => f.type) },
  ],
});

describe('getFieldNames', () => {
  beforeEach(() => {
    jest.mocked(getParserEnabled).mockReturnValue(true);
  });

  it('lists detected numeric fields first and keeps the other fields, without booleans', () => {
    expect(getFieldNames(frame)).toEqual({ numeric: ['latency', 'size', 'status'], other: ['caller'] });
  });

  it('only offers structured metadata when parsers are disabled', () => {
    jest.mocked(getParserEnabled).mockReturnValue(false);

    expect(getFieldNames(frame)).toEqual({ numeric: ['size'], other: [] });
  });
});

describe('getFieldOptions', () => {
  beforeEach(() => {
    jest.mocked(getParserEnabled).mockReturnValue(true);
  });

  it('groups numeric fields before the other fields', () => {
    const options = getFieldOptions(frame);

    expect(options.map((option) => option.value)).toEqual(['latency', 'size', 'status', 'caller']);
    expect(options[0]?.group).not.toBe(options[3]?.group);
  });

  it('keeps the selected field available', () => {
    expect(getFieldOptions(undefined, 'latency').map((option) => option.value)).toEqual(['latency']);
  });
});
