import { dateTime, LogsSortOrder, TimeRange } from '@grafana/data';

import { PLUGIN_ID } from './plugin';
import { generateLogShortlink } from './text';

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
