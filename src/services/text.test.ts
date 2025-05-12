import { dateTime, TimeRange } from '@grafana/data';

import { PLUGIN_ID } from './plugin';
import { generateLogShortlink } from './text';

// Var declaration is required to hoist subPath, so we can use it in both the jest.mock call below (which is also hoisted), and the test assertion
// eslint-disable-next-line no-var
var mockSubPath: string;
const protocolHost = 'http://localhost:3000';

jest.mock('@grafana/runtime', () => {
  mockSubPath = '/sub-path';
  return {
    ...jest.requireActual('@grafana/runtime'),
    config: {
      appSubUrl: mockSubPath,
    },
    locationService: {
      getLocation: () => location,
      getSearch: () => new URLSearchParams(location.search),
      replace: jest.fn(),
    },
  };
});

describe('generateLogShortlink', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: new URL(`${protocolHost}/a/${PLUGIN_ID}/explore?var-ds=DSID&from=now-5m&to=now`),
      writable: true,
    });
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
      logs: { displayedFields: ['field1', 'field2'], id: 'abc-123' },
    };

    expect(generateLogShortlink('panelState', panelState, timeRange)).toEqual(
      `http://localhost:3000${mockSubPath}/a/${PLUGIN_ID}/explore?var-ds=DSID&from=1970-01-01T00:00:00.000Z&to=1970-01-01T00:00:00.010Z&panelState=${encodeURI(
        JSON.stringify(panelState)
      )}`
    );
  });
});
