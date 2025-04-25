import { FieldType } from '@grafana/data';

import { getSeriesVisibleRange } from './logsFrame';

describe('logsFrame', () => {
  describe('getSeriesVisibleRange', () => {
    it('should not sort the timeField in place', () => {
      const timeField = {
        config: {},
        length: 2,
        name: 'time',
        type: FieldType.time,
        values: [2, 1],
      };
      const series = [{ fields: [timeField], length: 2 }];
      getSeriesVisibleRange(series);
      expect(timeField.values).toEqual([2, 1]);
    });

    it('should return the correct range when the values are sorted', () => {
      const timeField = {
        config: {},
        length: 2,
        name: 'time',
        type: FieldType.time,
        values: [1, 2],
      };
      const series = [{ fields: [timeField], length: 2 }];
      expect(getSeriesVisibleRange(series)).toEqual({ end: 2, start: 1 });
    });

    it('should return the correct range when the values are not sorted', () => {
      const timeField = {
        config: {},
        length: 2,
        name: 'time',
        type: FieldType.time,
        values: [2, 1],
      };
      const series = [{ fields: [timeField], length: 2 }];
      expect(getSeriesVisibleRange(series)).toEqual({ end: 2, start: 1 });
    });
  });
});
