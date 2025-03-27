import { FieldType, createDataFrame } from '@grafana/data';
import {
  CRITICAL_LEVEL_FIELD_NAME_REGEX,
  DEBUG_LEVEL_FIELD_NAME_REGEX,
  ERROR_LEVEL_FIELD_NAME_REGEX,
  INFO_LEVEL_FIELD_NAME_REGEX,
  setLevelColorOverrides,
  sortLevelTransformation,
  UNKNOWN_LEVEL_FIELD_NAME_REGEX,
  WARNING_LEVEL_FIELD_NAME_REGEX,
} from './panel';
import { lastValueFrom, of } from 'rxjs';

describe('setLevelColorOverrides', () => {
  test('Sets the color overrides for log levels', () => {
    const overrideColorMock = jest.fn();
    const matchFieldsWithNameByRegexMock = jest.fn().mockImplementation(() => ({ overrideColor: overrideColorMock }));

    const overrides = {
      matchFieldsWithNameByRegex: matchFieldsWithNameByRegexMock,
    };
    // @ts-expect-error
    setLevelColorOverrides(overrides);

    // Ensure the correct number of calls
    expect(matchFieldsWithNameByRegexMock).toHaveBeenCalledTimes(6);
    expect(overrideColorMock).toHaveBeenCalledTimes(6);

    // Check that regex is called correctly for each field
    expect(matchFieldsWithNameByRegexMock).toHaveBeenCalledWith(new RegExp(INFO_LEVEL_FIELD_NAME_REGEX).source);
    expect(matchFieldsWithNameByRegexMock).toHaveBeenCalledWith(new RegExp(DEBUG_LEVEL_FIELD_NAME_REGEX).source);
    expect(matchFieldsWithNameByRegexMock).toHaveBeenCalledWith(new RegExp(WARNING_LEVEL_FIELD_NAME_REGEX).source);
    expect(matchFieldsWithNameByRegexMock).toHaveBeenCalledWith(new RegExp(ERROR_LEVEL_FIELD_NAME_REGEX).source);
    expect(matchFieldsWithNameByRegexMock).toHaveBeenCalledWith(new RegExp(CRITICAL_LEVEL_FIELD_NAME_REGEX).source);
    expect(matchFieldsWithNameByRegexMock).toHaveBeenCalledWith(new RegExp(UNKNOWN_LEVEL_FIELD_NAME_REGEX).source);
  });
});

describe('sortLevelTransformation', () => {
  const dataFrameA = createDataFrame({
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1645029699311],
      },
      {
        name: 'Value',
        type: FieldType.number,
        labels: {
          level: 'error',
          location: 'moon',
          protocol: 'http',
        },
        config: {
          displayNameFromDS: 'error',
        },
        values: [23],
      },
    ],
  });
  const dataFrameB = createDataFrame({
    refId: 'B',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1645029699311],
      },
      {
        name: 'Value',
        type: FieldType.number,
        labels: {
          level: 'error',
          location: 'moon',
          protocol: 'http',
        },
        config: {
          displayNameFromDS: 'warn',
        },
        values: [23],
      },
    ],
  });
  const dataFrameC = createDataFrame({
    refId: 'C',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1645029699311],
      },
      {
        name: 'Value',
        type: FieldType.number,
        labels: {
          level: 'error',
          location: 'moon',
          protocol: 'http',
        },
        config: {
          displayNameFromDS: 'info',
        },
        values: [23],
      },
    ],
  });
  test('Sorts data frames by level', async () => {
    const result = await lastValueFrom(sortLevelTransformation()(of([dataFrameA, dataFrameB, dataFrameC])));
    expect(result).toEqual([dataFrameC, dataFrameB, dataFrameA]);
  });
});
