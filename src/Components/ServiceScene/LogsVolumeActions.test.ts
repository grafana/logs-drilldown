import { createDataFrame, Field, FieldType } from '@grafana/data';
import { sceneGraph } from '@grafana/scenes';

import { LogsVolumeActions, getAggregateByOptions } from './LogsVolumeActions';
import {
  DETECTED_FIELDS_CARDINALITY_NAME,
  DETECTED_FIELDS_NAME_FIELD,
  DETECTED_FIELDS_PARSER_NAME,
  DETECTED_FIELDS_TYPE_NAME,
} from 'services/datasource';
import { isLogsVolumeByFieldEnabled } from 'services/logsVolume';
import { getParserEnabled } from 'services/parserToggle';
import { LEVEL_VARIABLE_VALUE } from 'services/variables';

jest.mock('services/parserToggle', () => ({
  ...jest.requireActual('services/parserToggle'),
  getParserEnabled: jest.fn(() => true),
}));

jest.mock('services/logsVolume', () => ({
  isLogsVolumeByFieldEnabled: jest.fn(() => true),
}));

const getParserEnabledMock = jest.mocked(getParserEnabled);

function detectedFieldsFrame(fields: Array<{ name: string; parser: string; type: string }>) {
  const nameField: Field = {
    config: {},
    name: DETECTED_FIELDS_NAME_FIELD,
    type: FieldType.string,
    values: fields.map((field) => field.name),
  };
  const cardinalityField: Field = {
    config: {},
    name: DETECTED_FIELDS_CARDINALITY_NAME,
    type: FieldType.number,
    values: fields.map(() => 4),
  };
  const parserField: Field = {
    config: {},
    name: DETECTED_FIELDS_PARSER_NAME,
    type: FieldType.string,
    values: fields.map((field) => field.parser),
  };
  const typeField: Field = {
    config: {},
    name: DETECTED_FIELDS_TYPE_NAME,
    type: FieldType.string,
    values: fields.map((field) => field.type),
  };

  return createDataFrame({
    fields: [nameField, cardinalityField, parserField, typeField],
  });
}

const mixedFields = detectedFieldsFrame([
  { name: 'caller', parser: 'logfmt', type: 'string' },
  { name: 'ok', parser: 'logfmt', type: 'boolean' },
  { name: 'status', parser: 'json', type: 'int' },
  { name: 'latency', parser: 'logfmt', type: 'duration' },
  { name: 'ratio', parser: 'json', type: 'float' },
  { name: 'size', parser: 'logfmt', type: 'bytes' },
  { name: 'cluster', parser: '', type: 'string' },
  { name: 'level', parser: '', type: 'string' },
]);

describe('LogsVolumeActions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not load aggregate-by options when the feature flag is disabled', () => {
    jest.mocked(isLogsVolumeByFieldEnabled).mockReturnValue(false);
    const getAncestor = jest.spyOn(sceneGraph, 'getAncestor');
    const actions = new LogsVolumeActions({
      aggregateBy: LEVEL_VARIABLE_VALUE,
      onAggregateByChange: () => {},
    });

    actions.activate();

    expect(getAncestor).not.toHaveBeenCalled();
    expect(actions.state.options).toEqual([]);
  });
});

describe('getAggregateByOptions', () => {
  beforeEach(() => {
    getParserEnabledMock.mockReturnValue(true);
  });

  it('keeps categorical fields and always includes detected_level', () => {
    const options = getAggregateByOptions(mixedFields, LEVEL_VARIABLE_VALUE);

    expect(options.map((option) => option.value)).toEqual([LEVEL_VARIABLE_VALUE, 'caller', 'cluster', 'ok', 'status']);
  });

  it('drops float, duration, and bytes fields', () => {
    const values = getAggregateByOptions(mixedFields, LEVEL_VARIABLE_VALUE).map((option) => option.value);

    expect(values).not.toContain('latency');
    expect(values).not.toContain('ratio');
    expect(values).not.toContain('size');
  });

  it('drops parsed fields when parsers are disabled', () => {
    getParserEnabledMock.mockReturnValue(false);

    expect(getAggregateByOptions(mixedFields, LEVEL_VARIABLE_VALUE).map((option) => option.value)).toEqual([
      LEVEL_VARIABLE_VALUE,
      'cluster',
    ]);
  });

  it('prepends a selected field that is not already in the list', () => {
    const options = getAggregateByOptions(mixedFields, 'namespace');

    expect(options[0]).toEqual({ label: 'namespace', value: 'namespace' });
  });

  it('does not prepend a selected avg field', () => {
    const values = getAggregateByOptions(mixedFields, 'latency').map((option) => option.value);

    expect(values).not.toContain('latency');
  });
});
