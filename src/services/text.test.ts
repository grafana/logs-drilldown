import { dateTime, FieldType, LogsSortOrder, TimeRange, toDataFrame } from '@grafana/data';

import { LabelType } from './fieldsTypes';
import { FilterOp, LineFilterOp } from './filterTypes';
import { PLUGIN_ID } from './plugin';
import {
  capitalizeFirstLetter,
  ensureValidTimeRangeForLink,
  generateLink,
  generateLinkFromFilters,
  generateLogRowShortlink,
  generateLogShortlink,
  getLogLinePermalinkFilterParams,
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
    expect(url.searchParams.get('var-filters')).toBeDefined();
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

describe('getLogLinePermalinkFilterParams', () => {
  const makeLog = (overrides: Partial<PermalinkLogRow>): PermalinkLogRow => ({
    dataFrame: toDataFrame({ fields: [] }),
    labels: {},
    rowIndex: 0,
    timeEpochMs: 0,
    uniqueLabels: {},
    ...overrides,
  });

  test('returns empty filters for a row with no labels', () => {
    expect(getLogLinePermalinkFilterParams(makeLog({}))).toEqual({ fields: [], labels: [] });
  });

  test('derives a level field from the detected_level label', () => {
    const log = makeLog({
      dataFrame: toDataFrame({
        fields: [{ name: 'labelTypes', type: FieldType.other, values: [{ detected_level: 'S' }] }],
      }),
      labels: { detected_level: 'info' },
    });

    expect(getLogLinePermalinkFilterParams(log).fields).toEqual([
      { key: 'detected_level', operator: FilterOp.Equal, type: LabelType.StructuredMetadata, value: 'info' },
    ]);
  });

  test('defaults the level field type to Parsed when the frame has no label types', () => {
    const log = makeLog({ labels: { detected_level: 'warn' } });

    expect(getLogLinePermalinkFilterParams(log).fields).toEqual([
      { key: 'detected_level', operator: FilterOp.Equal, type: LabelType.Parsed, value: 'warn' },
    ]);
  });

  test('routes indexed labels to labels and structured metadata to fields', () => {
    const log = makeLog({
      dataFrame: toDataFrame({
        fields: [{ name: 'labelTypes', type: FieldType.other, values: [{ pod: 'I', region: 'S' }] }],
      }),
      uniqueLabels: { pod: 'mypod', region: 'us-east' },
    });

    const { fields, labels } = getLogLinePermalinkFilterParams(log);

    expect(labels).toEqual([{ key: 'pod', operator: FilterOp.Equal, type: LabelType.Indexed, value: 'mypod' }]);
    expect(fields).toEqual([
      {
        key: 'region',
        operator: FilterOp.Equal,
        parser: 'structuredMetadata',
        type: LabelType.StructuredMetadata,
        value: 'us-east',
      },
    ]);
  });

  test('skips reserved labels such as level and aggregated-metric markers', () => {
    const log = makeLog({
      uniqueLabels: { __aggregated_metric__: '1', detected_level: 'info', level: 'info', level_extracted: 'info' },
    });

    expect(getLogLinePermalinkFilterParams(log)).toEqual({ fields: [], labels: [] });
  });

  test('limits parsed fields to two to avoid overcrowding the filters', () => {
    const log = makeLog({
      dataFrame: toDataFrame({
        fields: [{ name: 'labelTypes', type: FieldType.other, values: [{ p1: 'P', p2: 'P', p3: 'P' }] }],
      }),
      uniqueLabels: { p1: 'a', p2: 'b', p3: 'c' },
    });

    const { fields } = getLogLinePermalinkFilterParams(log);

    expect(fields.map((field) => field.key)).toEqual(['p1', 'p2']);
    expect(fields.every((field) => field.parser === 'mixed')).toBe(true);
  });
});

describe('generateLinkFromFilters', () => {
  beforeEach(() => {
    window.history.pushState({}, '', `/a/${PLUGIN_ID}/explore`);
  });

  const path = `/a/${PLUGIN_ID}/explore?var-ds=DSID`;

  test('prepends the sub-path and preserves the existing query when no filters are given', () => {
    const url = new URL(generateLinkFromFilters(path, { labels: [] }));

    expect(url.origin).toEqual('http://localhost:3000');
    expect(url.pathname).toEqual(`${mockSubPath}/a/${PLUGIN_ID}/explore`);
    expect(url.searchParams.get('var-ds')).toEqual('DSID');
  });

  test('writes the time range into from/to params', () => {
    const timeRange: TimeRange = {
      from: dateTime(0),
      raw: { from: dateTime(0), to: dateTime(1000) },
      to: dateTime(1000),
    };

    const url = new URL(generateLinkFromFilters(path, { labels: [] }, timeRange));

    expect(url.searchParams.get('from')).toEqual(dateTime(0).toISOString());
    expect(url.searchParams.get('to')).toEqual(dateTime(1000).toISOString());
  });

  test('adds indexed label, field, and line filter params', () => {
    const url = new URL(
      generateLinkFromFilters(path, {
        fields: [{ key: 'region', operator: FilterOp.Equal, parser: 'mixed', type: LabelType.Parsed, value: 'us' }],
        labels: [{ key: 'pod', operator: FilterOp.Equal, type: LabelType.Indexed, value: 'mypod' }],
        lineFilters: [{ key: 'caseSensitive', operator: LineFilterOp.match, value: 'error' }],
      })
    );

    expect(url.searchParams.get('var-filters')).toContain('pod');
    expect(url.searchParams.get('var-fields')).toContain('region');
    expect(url.searchParams.get('var-lineFilters')).toContain('error');
  });

  test('replaces existing label params instead of duplicating them', () => {
    const pathWithLabel = `/a/${PLUGIN_ID}/explore?var-ds=DSID&var-filters=service_name|=|old`;

    const url = new URL(
      generateLinkFromFilters(pathWithLabel, {
        labels: [{ key: 'pod', operator: FilterOp.Equal, type: LabelType.Indexed, value: 'mypod' }],
      })
    );

    const labelParams = url.searchParams.getAll('var-filters');
    expect(labelParams).toHaveLength(1);
    expect(labelParams[0]).toContain('pod');
    expect(labelParams[0]).not.toContain('service_name');
  });

  test('replaces existing line filter params instead of duplicating them', () => {
    const pathWithLineFilter = `/a/${PLUGIN_ID}/explore?var-ds=DSID&var-lineFilters=caseSensitive|=|old`;

    const url = new URL(
      generateLinkFromFilters(pathWithLineFilter, {
        labels: [],
        lineFilters: [{ key: 'caseSensitive', operator: LineFilterOp.match, value: 'error' }],
      })
    );

    const lineFilterParams = url.searchParams.getAll('var-lineFilters');
    expect(lineFilterParams).toHaveLength(1);
    expect(lineFilterParams[0]).toContain('error');
    expect(lineFilterParams[0]).not.toContain('old');
  });

  test('replaces existing field and level params instead of duplicating them', () => {
    const pathWithFields = `/a/${PLUGIN_ID}/explore?var-ds=DSID&var-fields=region|=|old&var-levels=detected_level|=|warn`;

    const url = new URL(
      generateLinkFromFilters(pathWithFields, {
        fields: [{ key: 'region', operator: FilterOp.Equal, parser: 'mixed', type: LabelType.Parsed, value: 'us' }],
        labels: [],
      })
    );

    const fieldParams = url.searchParams.getAll('var-fields');
    expect(fieldParams).toHaveLength(1);
    expect(fieldParams[0]).toContain('us');
    expect(fieldParams[0]).not.toContain('old');
    // Levels are cleared alongside fields and not re-added when no level field is provided.
    expect(url.searchParams.getAll('var-levels')).toHaveLength(0);
  });

  test('preserves existing filter params when no matching filters are provided', () => {
    const pathWithFilters = `/a/${PLUGIN_ID}/explore?var-ds=DSID&var-filters=service_name|=|keep&var-lineFilters=caseSensitive|=|keep`;

    const url = new URL(generateLinkFromFilters(pathWithFilters, { labels: [] }));

    expect(url.searchParams.getAll('var-filters')).toEqual(['service_name|=|keep']);
    expect(url.searchParams.getAll('var-lineFilters')).toEqual(['caseSensitive|=|keep']);
  });
});
