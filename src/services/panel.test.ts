import { FieldType, createDataFrame } from '@grafana/data';
import { setLevelColorOverrides, sortLevelTransformation } from './panel';
import { lastValueFrom, of } from 'rxjs';

describe('setLevelColorOverrides', () => {
  test('Sets the color overrides for log levels', () => {
    const overrideColorMock = jest.fn();
    const matchFieldsWithNameMock = jest.fn().mockImplementation(() => ({ overrideColor: overrideColorMock }));
    const matchFieldsWithNameByRegexMock = jest.fn().mockImplementation(() => ({ overrideColor: overrideColorMock }));

    const overrides = {
      matchFieldsWithName: matchFieldsWithNameMock,
      matchFieldsWithNameByRegex: matchFieldsWithNameByRegexMock,
    };
    // @ts-expect-error
    setLevelColorOverrides(overrides);

    // Ensure the correct number of calls
    expect(matchFieldsWithNameMock).toHaveBeenCalledTimes(1);
    expect(matchFieldsWithNameByRegexMock).toHaveBeenCalledTimes(4);
    expect(overrideColorMock).toHaveBeenCalledTimes(5);

    // Check that regex is called correctly for each field
    expect(matchFieldsWithNameByRegexMock).toHaveBeenCalledWith('/^info$/i');
    expect(matchFieldsWithNameByRegexMock).toHaveBeenCalledWith('/^debug$/i');
    expect(matchFieldsWithNameByRegexMock).toHaveBeenCalledWith('/^error$/i');
    expect(matchFieldsWithNameByRegexMock).toHaveBeenCalledWith('/^(warn|warning)$/i');
    expect(matchFieldsWithNameMock).toHaveBeenCalledWith('logs');
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
