import { cloneDeep } from 'lodash';

import { DataFrame, DataFrameType, DataQueryResponse, Field, FieldType, QueryResultMetaStat } from '@grafana/data';

import { cloneQueryResponse, combineResponses } from './combineResponses';

describe('cloneQueryResponse', () => {
  const { logFrameA } = getMockFrames();
  const responseA: DataQueryResponse = {
    data: [logFrameA],
  };
  it('clones query responses', () => {
    const clonedA = cloneQueryResponse(responseA);
    expect(clonedA).not.toBe(responseA);
    expect(clonedA).toEqual(clonedA);
  });
});

describe('combineResponses', () => {
  it('combines logs frames', () => {
    const { logFrameA, logFrameB } = getMockFrames();
    const responseA: DataQueryResponse = {
      data: [logFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [logFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1, 2, 3, 4],
            },
            {
              config: {},
              name: 'Line',
              type: 'string',
              values: ['line3', 'line4', 'line1', 'line2'],
            },
            {
              config: {},
              name: 'labels',
              type: 'other',
              values: [
                {
                  otherLabel: 'other value',
                },
                {
                  label: 'value',
                },
                {
                  otherLabel: 'other value',
                },
              ],
            },
            {
              config: {},
              name: 'tsNs',
              type: 'string',
              values: ['1000000', '2000000', '3000000', '4000000'],
            },
            {
              config: {},
              name: 'id',
              type: 'string',
              values: ['id3', 'id4', 'id1', 'id2'],
            },
          ],
          length: 4,
          meta: {
            custom: {
              frameType: 'LabeledTimeValues',
            },
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
      ],
    });
  });

  it('combines logs frames with transformed fields', () => {
    const { logFrameA, logFrameB } = getMockFrames();
    const { logFrameB: originalLogFrameB } = getMockFrames();

    // Pseudo shuffle fields
    logFrameB.fields.sort((a: Field, b: Field) => (a.name < b.name ? -1 : 1));
    expect(logFrameB.fields).not.toEqual(originalLogFrameB.fields);

    const responseA: DataQueryResponse = {
      data: [logFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [logFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1, 2, 3, 4],
            },
            {
              config: {},
              name: 'Line',
              type: 'string',
              values: ['line3', 'line4', 'line1', 'line2'],
            },
            {
              config: {},
              name: 'labels',
              type: 'other',
              values: [
                {
                  otherLabel: 'other value',
                },
                {
                  label: 'value',
                },
                {
                  otherLabel: 'other value',
                },
              ],
            },
            {
              config: {},
              name: 'tsNs',
              type: 'string',
              values: ['1000000', '2000000', '3000000', '4000000'],
            },
            {
              config: {},
              name: 'id',
              type: 'string',
              values: ['id3', 'id4', 'id1', 'id2'],
            },
          ],
          length: 4,
          meta: {
            custom: {
              frameType: 'LabeledTimeValues',
            },
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
      ],
    });
  });

  it('combines metric frames', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1000000, 2000000, 3000000, 4000000],
            },
            {
              config: {},
              labels: {
                level: 'debug',
              },
              name: 'Value',
              type: 'number',
              values: [6, 7, 5, 4],
            },
          ],
          length: 4,
          meta: {
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
            type: 'timeseries-multi',
          },
          name: '{"level":"debug"}',
          refId: 'A',
        },
      ],
    });
  });

  it('combines and identifies new frames in the response', () => {
    const { metricFrameA, metricFrameB, metricFrameC } = getMockFrames();
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB, metricFrameC],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1000000, 2000000, 3000000, 4000000],
            },
            {
              config: {},
              labels: {
                level: 'debug',
              },
              name: 'Value',
              type: 'number',
              values: [6, 7, 5, 4],
            },
          ],
          length: 4,
          meta: {
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
            type: 'timeseries-multi',
          },
          name: '{"level":"debug"}',
          refId: 'A',
        },
        metricFrameC,
      ],
    });
  });

  it('combines frames prioritizing refIds over names', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    const dataFrameA = {
      ...metricFrameA,
      name: 'A',
      refId: 'A',
    };
    const dataFrameB = {
      ...metricFrameB,
      name: 'A',
      refId: 'B',
    };
    const responseA: DataQueryResponse = {
      data: [dataFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [dataFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [dataFrameA, dataFrameB],
    });
  });

  it('combines frames in a new response instance', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };
    expect(combineResponses(null, responseA)).not.toBe(responseA);
    expect(combineResponses(null, responseB)).not.toBe(responseB);
  });

  it('combine when first param has errors', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    const errorA = {
      message: 'errorA',
    };
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
      error: errorA,
      errors: [errorA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };

    const combined = combineResponses(responseA, responseB);
    expect(combined.data[0].length).toBe(4);
    expect(combined.error?.message).toBe('errorA');
    expect(combined.errors).toHaveLength(1);
    expect(combined.errors?.[0]?.message).toBe('errorA');
  });

  it('combine when second param has errors', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const errorB = {
      message: 'errorB',
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
      error: errorB,
      errors: [errorB],
    };

    const combined = combineResponses(responseA, responseB);
    expect(combined.data[0].length).toBe(4);
    expect(combined.error?.message).toBe('errorB');
    expect(combined.errors).toHaveLength(1);
    expect(combined.errors?.[0]?.message).toBe('errorB');
  });

  it('combine when both frames have errors', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    const errorA = {
      message: 'errorA',
    };
    const errorB = {
      message: 'errorB',
    };
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
      error: errorA,
      errors: [errorA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
      error: errorB,
      errors: [errorB],
    };

    const combined = combineResponses(responseA, responseB);
    expect(combined.data[0].length).toBe(4);
    expect(combined.error?.message).toBe('errorA');
    expect(combined.errors).toHaveLength(2);
    expect(combined.errors?.[0]?.message).toBe('errorA');
    expect(combined.errors?.[1]?.message).toBe('errorB');
  });

  it('combines frames with nanoseconds', () => {
    const { logFrameA, logFrameB } = getMockFrames();
    logFrameA.fields[0].nanos = [333333, 444444];
    logFrameB.fields[0].nanos = [111111, 222222];
    const responseA: DataQueryResponse = {
      data: [logFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [logFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              nanos: [111111, 222222, 333333, 444444],
              type: 'time',
              values: [1, 2, 3, 4],
            },
            {
              config: {},
              name: 'Line',
              type: 'string',
              values: ['line3', 'line4', 'line1', 'line2'],
            },
            {
              config: {},
              name: 'labels',
              type: 'other',
              values: [
                {
                  otherLabel: 'other value',
                },
                {
                  label: 'value',
                },
                {
                  otherLabel: 'other value',
                },
              ],
            },
            {
              config: {},
              name: 'tsNs',
              type: 'string',
              values: ['1000000', '2000000', '3000000', '4000000'],
            },
            {
              config: {},
              name: 'id',
              type: 'string',
              values: ['id3', 'id4', 'id1', 'id2'],
            },
          ],
          length: 4,
          meta: {
            custom: {
              frameType: 'LabeledTimeValues',
            },
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
      ],
    });
  });

  it('combines frames without nanoseconds with frames with nanoseconds', () => {
    const { logFrameA, logFrameB } = getMockFrames();
    logFrameA.fields[0].nanos = undefined;
    logFrameB.fields[0].nanos = [111111, 222222];
    const responseA: DataQueryResponse = {
      data: [logFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [logFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              nanos: [111111, 222222, 0, 0],
              type: 'time',
              values: [1, 2, 3, 4],
            },
            {
              config: {},
              name: 'Line',
              type: 'string',
              values: ['line3', 'line4', 'line1', 'line2'],
            },
            {
              config: {},
              name: 'labels',
              type: 'other',
              values: [
                {
                  otherLabel: 'other value',
                },
                {
                  label: 'value',
                },
                {
                  otherLabel: 'other value',
                },
              ],
            },
            {
              config: {},
              name: 'tsNs',
              type: 'string',
              values: ['1000000', '2000000', '3000000', '4000000'],
            },
            {
              config: {},
              name: 'id',
              type: 'string',
              values: ['id3', 'id4', 'id1', 'id2'],
            },
          ],
          length: 4,
          meta: {
            custom: {
              frameType: 'LabeledTimeValues',
            },
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
      ],
    });
  });

  describe('combine stats', () => {
    const { metricFrameA } = getMockFrames();
    const makeResponse = (stats?: QueryResultMetaStat[]): DataQueryResponse => ({
      data: [
        {
          ...metricFrameA,
          meta: {
            ...metricFrameA.meta,
            stats,
          },
        },
      ],
    });
    it('two values', () => {
      const responseA = makeResponse([
        { displayName: 'Ingester: total reached', value: 1 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
      ]);
      const responseB = makeResponse([
        { displayName: 'Ingester: total reached', value: 2 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 22 },
      ]);

      expect(combineResponses(responseA, responseB).data[0].meta.stats).toStrictEqual([
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 33 },
      ]);
    });

    it('one value', () => {
      const responseA = makeResponse([
        { displayName: 'Ingester: total reached', value: 1 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
      ]);
      const responseB = makeResponse();

      expect(combineResponses(responseA, responseB).data[0].meta.stats).toStrictEqual([
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
      ]);

      expect(combineResponses(responseB, responseA).data[0].meta.stats).toStrictEqual([
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
      ]);
    });

    it('no value', () => {
      const responseA = makeResponse();
      const responseB = makeResponse();
      expect(combineResponses(responseA, responseB).data[0].meta.stats).toHaveLength(0);
    });
  });

  it('does not combine frames with different refId', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    metricFrameA.refId = 'A';
    metricFrameB.refId = 'B';
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [metricFrameA, metricFrameB],
    });
  });

  it('does not combine frames with different refId', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    metricFrameA.name = 'A';
    metricFrameB.name = 'B';
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [metricFrameA, metricFrameB],
    });
  });

  it('when fields with the same name are present, uses labels to find the right field to combine', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();

    metricFrameA.fields.push({
      config: {},
      labels: {
        test: 'true',
      },
      name: 'Value',
      type: FieldType.number,
      values: [9, 8],
    });
    metricFrameB.fields.push({
      config: {},
      labels: {
        test: 'true',
      },
      name: 'Value',
      type: FieldType.number,
      values: [11, 10],
    });

    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };

    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1000000, 2000000, 3000000, 4000000],
            },
            {
              config: {},
              labels: {
                level: 'debug',
              },
              name: 'Value',
              type: 'number',
              values: [6, 7, 5, 4],
            },
            {
              config: {},
              labels: {
                test: 'true',
              },
              name: 'Value',
              type: 'number',
              values: [11, 10, 9, 8],
            },
          ],
          length: 4,
          meta: {
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
            type: 'timeseries-multi',
          },
          name: '{"level":"debug"}',
          refId: 'A',
        },
      ],
    });
  });

  it('when fields with the same name are present and labels are not present, falls back to indexes', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();

    delete metricFrameA.fields[1].labels;
    delete metricFrameB.fields[1].labels;

    metricFrameA.fields.push({
      config: {},
      name: 'Value',
      type: FieldType.number,
      values: [9, 8],
    });
    metricFrameB.fields.push({
      config: {},
      name: 'Value',
      type: FieldType.number,
      values: [11, 10],
    });

    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };

    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1000000, 2000000, 3000000, 4000000],
            },
            {
              config: {},
              name: 'Value',
              type: 'number',
              values: [6, 7, 5, 4],
            },
            {
              config: {},
              name: 'Value',
              type: 'number',
              values: [11, 10, 9, 8],
            },
          ],
          length: 4,
          meta: {
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
            type: 'timeseries-multi',
          },
          refId: 'A',
        },
      ],
    });
  });
});

describe('mergeFrames', () => {
  it('combines metric frames', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    const responseA: DataQueryResponse = {
      data: [metricFrameB],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameA],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1000000, 2000000, 3000000, 4000000],
            },
            {
              config: {},
              labels: {
                level: 'debug',
              },
              name: 'Value',
              type: 'number',
              values: [6, 7, 5, 4],
            },
          ],
          length: 4,
          meta: {
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
            type: 'timeseries-multi',
          },
          name: '{"level":"debug"}',
          refId: 'A',
        },
      ],
    });
  });

  it('adds old to new values when combining', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();

    metricFrameB.fields[0].values = [3000000, 3500000, 4000000];
    metricFrameB.fields[1].values = [5, 10, 6];

    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [3000000, 3500000, 4000000],
            },
            {
              config: {},
              labels: {
                level: 'debug',
              },
              name: 'Value',
              type: 'number',
              values: [10, 10, 10],
            },
          ],
          length: 3,
          meta: {
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
            type: 'timeseries-multi',
          },
          name: '{"level":"debug"}',
          refId: 'A',
        },
      ],
    });
  });

  it('combines and identifies new frames in the response', () => {
    const { metricFrameA, metricFrameB, metricFrameC } = getMockFrames();
    const responseA: DataQueryResponse = {
      data: [metricFrameB],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameA, metricFrameC],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1000000, 2000000, 3000000, 4000000],
            },
            {
              config: {},
              labels: {
                level: 'debug',
              },
              name: 'Value',
              type: 'number',
              values: [6, 7, 5, 4],
            },
          ],
          length: 4,
          meta: {
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
            type: 'timeseries-multi',
          },
          name: '{"level":"debug"}',
          refId: 'A',
        },
        metricFrameC,
      ],
    });
  });

  it('merges logs frames', () => {
    const { logFrameA, logFrameB } = getMockFrames();

    // 3 overlaps with logFrameA
    logFrameB.fields[0].values = [2, 3];
    logFrameB.fields[1].values = ['line4', 'line1'];
    logFrameB.fields[4].values = ['id4', 'id1'];

    const responseA: DataQueryResponse = {
      data: [logFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [logFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [2, 3, 4],
            },
            {
              config: {},
              name: 'Line',
              type: 'string',
              values: ['line4', 'line1', 'line2'],
            },
            {
              config: {},
              name: 'labels',
              type: 'other',
              values: [
                {
                  otherLabel: 'other value',
                },
                {
                  label: 'value',
                },
                {
                  otherLabel: 'other value',
                },
              ],
            },
            {
              config: {},
              name: 'tsNs',
              type: 'string',
              values: ['1000000', '2000000', '4000000'],
            },
            {
              config: {},
              name: 'id',
              type: 'string',
              values: ['id4', 'id1', 'id2'],
            },
          ],
          length: 3,
          meta: {
            custom: {
              frameType: 'LabeledTimeValues',
            },
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
      ],
    });
  });

  it('merges frames with nanoseconds', () => {
    const { logFrameA, logFrameB } = getMockFrames();

    logFrameA.fields[0].values = [3, 4];
    logFrameA.fields[0].nanos = [333333, 444444];

    // 3 overlaps with logFrameA
    logFrameB.fields[0].values = [2, 3];
    logFrameB.fields[0].nanos = [222222, 333333];
    logFrameB.fields[4].values = ['id4', 'id1'];

    const responseA: DataQueryResponse = {
      data: [logFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [logFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              nanos: [222222, 333333, 444444],
              type: 'time',
              values: [2, 3, 4],
            },
            {
              config: {},
              name: 'Line',
              type: 'string',
              values: ['line3', 'line4', 'line2'],
            },
            {
              config: {},
              name: 'labels',
              type: 'other',
              values: [
                {
                  otherLabel: 'other value',
                },
                {
                  label: 'value',
                },
                {
                  otherLabel: 'other value',
                },
              ],
            },
            {
              config: {},
              name: 'tsNs',
              type: 'string',
              values: ['1000000', '2000000', '4000000'],
            },
            {
              config: {},
              name: 'id',
              type: 'string',
              values: ['id4', 'id1', 'id2'],
            },
          ],
          length: 3,
          meta: {
            custom: {
              frameType: 'LabeledTimeValues',
            },
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
      ],
    });
  });

  it('receiving existing values do not introduce inconsistencies', () => {
    const { logFrameA, logFrameAB } = getMockFrames();

    const responseA: DataQueryResponse = {
      data: [cloneDeep(logFrameAB)],
    };
    const responseB: DataQueryResponse = {
      data: [cloneDeep(logFrameA)],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          ...logFrameAB,
          meta: {
            custom: {
              frameType: 'LabeledTimeValues',
            },
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
        },
      ],
    });
  });

  it('considers nanoseconds to merge the frames', () => {
    const { logFrameA, logFrameB } = getMockFrames();

    // Same timestamps but different nanos
    logFrameA.fields[0].values = [1, 2];
    logFrameA.fields[0].nanos = [333333, 444444];
    logFrameB.fields[0].values = [1, 2];
    logFrameB.fields[0].nanos = [222222, 333333];

    const responseA: DataQueryResponse = {
      data: [logFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [logFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              nanos: [222222, 333333, 333333, 444444],
              type: 'time',
              values: [1, 1, 2, 2],
            },
            {
              config: {},
              name: 'Line',
              type: 'string',
              values: ['line3', 'line1', 'line4', 'line2'],
            },
            {
              config: {},
              name: 'labels',
              type: 'other',
              values: [
                {
                  otherLabel: 'other value',
                },
                {
                  label: 'value',
                },
                {
                  otherLabel: 'other value',
                },
              ],
            },
            {
              config: {},
              name: 'tsNs',
              type: 'string',
              values: ['1000000', '3000000', '2000000', '4000000'],
            },
            {
              config: {},
              name: 'id',
              type: 'string',
              values: ['id3', 'id1', 'id4', 'id2'],
            },
          ],
          length: 4,
          meta: {
            custom: {
              frameType: 'LabeledTimeValues',
            },
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
      ],
    });
  });

  it('correctly handles empty responses', () => {
    const { emptyFrame, logFrameB } = getMockFrames();

    logFrameB.fields[0].values = [1, 2];
    logFrameB.fields[0].nanos = [222222, 333333];

    const responseA: DataQueryResponse = {
      data: [emptyFrame],
    };
    const responseB: DataQueryResponse = {
      data: [logFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          ...logFrameB,
          length: 2,
          meta: {
            custom: {
              frameType: 'LabeledTimeValues',
            },
            stats: [{ displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 22 }],
          },
        },
      ],
    });
  });

  it('merging exactly the same data produces the same data', () => {
    const { logFrameA } = getMockFrames();

    const responseA: DataQueryResponse = {
      data: [cloneDeep(logFrameA)],
    };
    const responseB: DataQueryResponse = {
      data: [cloneDeep(logFrameA)],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          ...logFrameA,
          meta: {
            custom: {
              frameType: 'LabeledTimeValues',
            },
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 22,
              },
            ],
          },
        },
      ],
    });
  });
});

export function getMockFrames() {
  const logFrameA: DataFrame = {
    fields: [
      {
        config: {},
        name: 'Time',
        type: FieldType.time,
        values: [3, 4],
      },
      {
        config: {},
        name: 'Line',
        type: FieldType.string,
        values: ['line1', 'line2'],
      },
      {
        config: {},
        name: 'labels',
        type: FieldType.other,
        values: [
          {
            label: 'value',
          },
          {
            otherLabel: 'other value',
          },
        ],
      },
      {
        config: {},
        name: 'tsNs',
        type: FieldType.string,
        values: ['3000000', '4000000'],
      },
      {
        config: {},
        name: 'id',
        type: FieldType.string,
        values: ['id1', 'id2'],
      },
    ],
    length: 2,
    meta: {
      custom: {
        frameType: 'LabeledTimeValues',
      },
      stats: [
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
        { displayName: 'Ingester: total reached', value: 1 },
      ],
    },
    refId: 'A',
  };

  const logFrameB: DataFrame = {
    fields: [
      {
        config: {},
        name: 'Time',
        type: FieldType.time,
        values: [1, 2],
      },
      {
        config: {},
        name: 'Line',
        type: FieldType.string,
        values: ['line3', 'line4'],
      },
      {
        config: {},
        name: 'labels',
        type: FieldType.other,
        values: [
          {
            otherLabel: 'other value',
          },
        ],
      },
      {
        config: {},
        name: 'tsNs',
        type: FieldType.string,
        values: ['1000000', '2000000'],
      },
      {
        config: {},
        name: 'id',
        type: FieldType.string,
        values: ['id3', 'id4'],
      },
    ],
    length: 2,
    meta: {
      custom: {
        frameType: 'LabeledTimeValues',
      },
      stats: [
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 22 },
        { displayName: 'Ingester: total reached', value: 2 },
      ],
    },
    refId: 'A',
  };

  const logFrameAB: DataFrame = {
    fields: [
      {
        config: {},
        name: 'Time',
        type: FieldType.time,
        values: [1, 2, 3, 4],
      },
      {
        config: {},
        name: 'Line',
        type: FieldType.string,
        values: ['line3', 'line4', 'line1', 'line2'],
      },
      {
        config: {},
        name: 'labels',
        type: FieldType.other,
        values: [
          {
            otherLabel: 'other value',
          },
          undefined,
          {
            label: 'value',
          },
          {
            otherLabel: 'other value',
          },
        ],
      },
      {
        config: {},
        name: 'tsNs',
        type: FieldType.string,
        values: ['1000000', '2000000', '3000000', '4000000'],
      },
      {
        config: {},
        name: 'id',
        type: FieldType.string,
        values: ['id3', 'id4', 'id1', 'id2'],
      },
    ],
    length: 4,
    meta: {
      custom: {
        frameType: 'LabeledTimeValues',
      },
      stats: [
        {
          displayName: 'Summary: total bytes processed',
          unit: 'decbytes',
          value: 22,
        },
      ],
    },
    refId: 'A',
  };

  const metricFrameA: DataFrame = {
    fields: [
      {
        config: {},
        name: 'Time',
        type: FieldType.time,
        values: [3000000, 4000000],
      },
      {
        config: {},
        labels: {
          level: 'debug',
        },
        name: 'Value',
        type: FieldType.number,
        values: [5, 4],
      },
    ],
    length: 2,
    meta: {
      stats: [
        { displayName: 'Ingester: total reached', value: 1 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
      ],
      type: DataFrameType.TimeSeriesMulti,
    },
    refId: 'A',
  };

  const metricFrameB: DataFrame = {
    fields: [
      {
        config: {},
        name: 'Time',
        type: FieldType.time,
        values: [1000000, 2000000],
      },
      {
        config: {},
        labels: {
          level: 'debug',
        },
        name: 'Value',
        type: FieldType.number,
        values: [6, 7],
      },
    ],
    length: 2,
    meta: {
      stats: [
        { displayName: 'Ingester: total reached', value: 2 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 22 },
      ],
      type: DataFrameType.TimeSeriesMulti,
    },
    refId: 'A',
  };

  const metricFrameC: DataFrame = {
    fields: [
      {
        config: {},
        name: 'Time',
        type: FieldType.time,
        values: [3000000, 4000000],
      },
      {
        config: {},
        labels: {
          level: 'error',
        },
        name: 'Value',
        type: FieldType.number,
        values: [6, 7],
      },
    ],
    length: 2,
    meta: {
      stats: [
        { displayName: 'Ingester: total reached', value: 2 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 33 },
      ],
      type: DataFrameType.TimeSeriesMulti,
    },
    name: 'some-time-series',
    refId: 'A',
  };

  const emptyFrame: DataFrame = {
    fields: [
      {
        config: {},
        name: 'Time',
        type: FieldType.time,
        values: [],
      },
      {
        config: {},
        name: 'Line',
        type: FieldType.string,
        values: [],
      },
      {
        config: {},
        name: 'labels',
        type: FieldType.other,
        values: [],
      },
      {
        config: {},
        name: 'tsNs',
        type: FieldType.string,
        values: [],
      },
      {
        config: {},
        name: 'id',
        type: FieldType.string,
        values: [],
      },
    ],
    length: 2,
    meta: {
      custom: {
        frameType: 'LabeledTimeValues',
      },
      stats: [
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 0 },
        { displayName: 'Ingester: total reached', value: 0 },
      ],
    },
    refId: 'A',
  };

  return {
    emptyFrame,
    logFrameA,
    logFrameAB,
    logFrameB,
    metricFrameA,
    metricFrameB,
    metricFrameC,
  };
}
