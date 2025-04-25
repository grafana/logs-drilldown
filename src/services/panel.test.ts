import { lastValueFrom, of } from 'rxjs';

import { createDataFrame, FieldType } from '@grafana/data';

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
    fields: [
      {
        config: {},
        name: 'Time',
        type: FieldType.time,
        values: [1645029699311],
      },
      {
        config: {
          displayNameFromDS: 'error',
        },
        labels: {
          level: 'error',
          location: 'moon',
          protocol: 'http',
        },
        name: 'Value',
        type: FieldType.number,
        values: [23],
      },
    ],
    refId: 'A',
  });
  const dataFrameB = createDataFrame({
    fields: [
      {
        config: {},
        name: 'Time',
        type: FieldType.time,
        values: [1645029699311],
      },
      {
        config: {
          displayNameFromDS: 'warn',
        },
        labels: {
          level: 'error',
          location: 'moon',
          protocol: 'http',
        },
        name: 'Value',
        type: FieldType.number,
        values: [23],
      },
    ],
    refId: 'B',
  });
  const dataFrameC = createDataFrame({
    fields: [
      {
        config: {},
        name: 'Time',
        type: FieldType.time,
        values: [1645029699311],
      },
      {
        config: {
          displayNameFromDS: 'info',
        },
        labels: {
          level: 'error',
          location: 'moon',
          protocol: 'http',
        },
        name: 'Value',
        type: FieldType.number,
        values: [23],
      },
    ],
    refId: 'C',
  });
  test('Sorts data frames by level', async () => {
    const result = await lastValueFrom(sortLevelTransformation()(of([dataFrameA, dataFrameB, dataFrameC])));
    expect(result).toEqual([dataFrameC, dataFrameB, dataFrameA]);
  });
});
