import { dateTime, FieldType, LogsSortOrder, TimeRange, toDataFrame } from '@grafana/data';

import { PLUGIN_ID } from './plugin';
import {
  capitalizeFirstLetter,
  ensureValidTimeRangeForLink,
  generateLink,
  generateLogRowShortlink,
  generateLogShortlink,
  PermalinkLogRow,
  resolveRowTimeRangeForSharing,
  truncateText,
} from './text';

// Var declaration is required to hoist subPath, so we can use it in both the jest.mock call below (which is also hoisted), and the test assertion
// eslint-disable-next-line no-var
var mockSubPath: string;

jest.mock('@grafana/runtime', () => {
  mockSubPath = '/sub-path';
  return {
    ...jest.requireActual('@grafana/runtime'),
    config: {
      appSubUrl: mockSubPath,
    },
    locationService: {
      // Uses the jsdom window.location set via history.pushState in beforeEach
      getLocation: () => window.location,
      getSearch: () => new URLSearchParams(window.location.search),
      replace: jest.fn(),
    },
  };
});

describe('generateLogShortlink', () => {
  beforeEach(() => {
    // Set up the URL for this test - history.pushState works in jsdom
    window.history.pushState({}, '', `/a/${PLUGIN_ID}/explore?var-ds=DSID&from=now-5m&to=now`);
  });

  test('generated log link contains subpath', () => {
    const timeRange: TimeRange = {
      from: dateTime(0),
      raw: {
        from: dateTime(0),
        to: dateTime(10),
      },
      to: dateTime(10),
    };
    const panelState = {
      logs: { displayedFields: ['field1', 'field2'], id: 'abc-123', sortOrder: LogsSortOrder.Ascending },
    };

    expect(generateLogShortlink('panelState', panelState, timeRange)).toEqual(
      `http://localhost:3000${mockSubPath}/a/${PLUGIN_ID}/explore?var-ds=DSID&from=1970-01-01T00:00:00.000Z&to=1970-01-01T00:00:00.010Z&panelState=${encodeURI(
        JSON.stringify(panelState)
      )}`
    );
  });
});

describe('generateLink', () => {
  beforeEach(() => {
    window.history.pushState({}, '', `/a/${PLUGIN_ID}/explore`);
  });

  test('prepends protocol, host, and configured sub-path to the relative url', () => {
    expect(generateLink(`/a/${PLUGIN_ID}/explore?var-ds=DSID`)).toEqual(
      `http://localhost:3000${mockSubPath}/a/${PLUGIN_ID}/explore?var-ds=DSID`
    );
  });

  test('handles an empty relative url', () => {
    expect(generateLink('')).toEqual(`http://localhost:3000${mockSubPath}`);
  });
});

describe('capitalizeFirstLetter', () => {
  test('capitalizes the first letter and keeps the rest unchanged', () => {
    expect(capitalizeFirstLetter('hello')).toEqual('Hello');
  });

  test('leaves an already capitalized string unchanged', () => {
    expect(capitalizeFirstLetter('Hello world')).toEqual('Hello world');
  });
});

describe('truncateText', () => {
  test('truncates and appends an ellipsis when the input is longer than the length', () => {
    expect(truncateText('hello world', 5, true)).toEqual('hello…');
  });

  test('does not append an ellipsis when ellipsis is disabled', () => {
    expect(truncateText('hello world', 5, false)).toEqual('hello');
  });

  test('does not append an ellipsis when the input fits within the length', () => {
    expect(truncateText('hi', 5, true)).toEqual('hi');
  });
});

describe('ensureValidTimeRangeForLink', () => {
  test('returns the original range when end is after start', () => {
    expect(ensureValidTimeRangeForLink(1000, 5000)).toEqual([1000, 5000]);
  });

  test('expands the range by 1000ms when end equals start', () => {
    expect(ensureValidTimeRangeForLink(1000, 1000)).toEqual([1000, 2000]);
  });

  test('expands the range by 1000ms when end is before start', () => {
    expect(ensureValidTimeRangeForLink(5000, 1000)).toEqual([5000, 6000]);
  });
});

describe('resolveRowTimeRangeForSharing', () => {
  test('builds a 1000ms range centered on the log timestamp', () => {
    const timeEpochMs = 1_000_000;
    const range = resolveRowTimeRangeForSharing({ timeEpochMs });

    expect(range.from.valueOf()).toEqual(timeEpochMs - 500);
    expect(range.to.valueOf()).toEqual(timeEpochMs + 500);
    expect(range.raw.from.valueOf()).toEqual(timeEpochMs - 500);
    expect(range.raw.to.valueOf()).toEqual(timeEpochMs + 500);
    expect(range.to.valueOf() - range.from.valueOf()).toEqual(1000);
  });
});

describe('generateLogRowShortlink', () => {
  const timeEpochMs = 1_000_000;

  beforeEach(() => {
    window.history.pushState(
      {},
      '',
      `/a/${PLUGIN_ID}/explore/service/test/logs?var-ds=DSID&var-filters=service_name|=|test&from=now-5m&to=now`
    );
  });

  test('preserves existing params, injects the panel state, and derives the time range from the row', () => {
    const log: PermalinkLogRow = {
      dataFrame: toDataFrame({ fields: [] }),
      labels: {},
      rowIndex: 0,
      timeEpochMs,
      uniqueLabels: {},
    };
    const panelState = {
      logs: { displayedFields: ['field1'], id: 'abc-123', sortOrder: LogsSortOrder.Descending },
    };

    const url = new URL(generateLogRowShortlink(log, panelState));

    expect(url.origin).toEqual('http://localhost:3000');
    expect(url.pathname).toEqual(`${mockSubPath}/a/${PLUGIN_ID}/explore/service/test/logs`);
    expect(url.searchParams.get('var-ds')).toEqual('DSID');
    expect(url.searchParams.get('panelState')).toEqual(JSON.stringify(panelState));
    // The time range is centered on the log line, not the original now-5m/now picker range.
    expect(url.searchParams.get('from')).toEqual(dateTime(timeEpochMs - 500).toISOString());
    expect(url.searchParams.get('to')).toEqual(dateTime(timeEpochMs + 500).toISOString());
    // No fields/labels filters were derived from this empty row.
    expect(url.searchParams.get('var-fields')).toBeNull();
    expect(url.searchParams.get('var-labels')).toBeNull();
  });

  test('derives level and structured-metadata field filters but drops indexed labels', () => {
    const log: PermalinkLogRow = {
      dataFrame: toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [timeEpochMs] },
          { name: 'Line', type: FieldType.string, values: ['line'] },
          {
            name: 'labelTypes',
            type: FieldType.other,
            values: [{ detected_level: 'S', pod: 'I', service: 'S' }],
          },
        ],
      }),
      labels: { detected_level: 'info' },
      rowIndex: 0,
      timeEpochMs,
      uniqueLabels: { detected_level: 'info', pod: 'mypod', service: 'mysvc' },
    };

    const url = new URL(generateLogRowShortlink(log));

    // `detected_level` is structured metadata so it lands in the levels variable.
    expect(url.searchParams.get('var-levels')).toContain('detected_level');
    // `service` is structured metadata so it lands in the metadata variable.
    expect(url.searchParams.get('var-metadata')).toContain('service');
    // `pod` is an indexed label, which generateLogRowShortlink intentionally drops.
    expect(url.searchParams.get('var-labels')).toBeNull();
  });

  test('uses the provided param name for the panel state', () => {
    const log: PermalinkLogRow = {
      dataFrame: toDataFrame({ fields: [] }),
      labels: {},
      rowIndex: 0,
      timeEpochMs,
      uniqueLabels: {},
    };
    const panelState = { id: 'row-1', row: 3 };

    const url = new URL(generateLogRowShortlink(log, panelState, 'customState'));

    expect(url.searchParams.get('customState')).toEqual(JSON.stringify(panelState));
    expect(url.searchParams.get('panelState')).toBeNull();
  });
});
