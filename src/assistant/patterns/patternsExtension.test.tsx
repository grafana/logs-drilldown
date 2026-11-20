import React from 'react';

import { act, render, screen } from '@testing-library/react';

import { t } from '@grafana/i18n';

import {
  assistantExtensionManifest,
  getLastAssistantLogsQuery,
  PatternsReply,
  SuspendedPatternsReply,
} from './patternsExtension';
import { getAssistantExtensionConfig, type InlineChitTurn } from 'assistant/extensionConfig';
import pluginJson from 'plugin.json';
import { initI18n, SuspendedPatterns } from 'services/extensions/exposedComponents';

jest.mock('services/extensions/exposedComponents', () => ({
  initI18n: jest.fn().mockResolvedValue(undefined),
  SuspendedPatterns: jest.fn(() => <div>Native Patterns</div>),
}));

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: jest.fn((_key: string, fallback: string) => fallback),
}));

const input = {
  operation: 'execute',
  query_type: 'range',
  datasource_uid: 'loki',
  query: '{service_name="api"} |= "error"',
  start: '2026-11-20T10:00:00Z',
  end: '2026-11-20T11:00:00Z',
};

function turn(value: unknown = input, isStreaming = false): InlineChitTurn {
  return { isStreaming, tools: [{ name: 'loki_query_handler', input: value }] };
}

beforeEach(() => jest.clearAllMocks());

it('reads the real Loki tool input and passes its unchanged query and range to native Patterns', () => {
  render(<PatternsReply turn={turn()} />);
  expect(screen.getByText('Native Patterns')).toBeInTheDocument();
  const props = jest.mocked(SuspendedPatterns).mock.lastCall?.[0];
  expect(props).toMatchObject({ datasourceUid: 'loki', query: input.query });
  expect(props?.timeRange.from.toISOString()).toBe('2026-11-20T10:00:00.000Z');
  expect(props?.timeRange.to.toISOString()).toBe('2026-11-20T11:00:00.000Z');
});

it('uses the latest execute call, ignoring later discovery and unrelated tools', () => {
  expect(
    getLastAssistantLogsQuery({
      isStreaming: false,
      tools: [
        ...turn().tools,
        { name: 'loki_query_handler', input: { ...input, datasource_uid: 'other', query: '{app="new"}' } },
        { name: 'loki_query_handler', input: { operation: 'search_label_names' } },
        { name: 'tempo_query_handler', input },
      ],
    })
  ).toMatchObject({ datasourceUid: 'other', query: '{app="new"}' });
});

it('waits for the turn to settle and responds to updated query inputs', () => {
  const view = render(<PatternsReply turn={turn(input, true)} />);
  expect(SuspendedPatterns).not.toHaveBeenCalled();
  expect(screen.getByText('Loading Log Patterns...')).toBeInTheDocument();
  view.rerender(<PatternsReply turn={turn()} />);
  expect(screen.getByText('Native Patterns')).toBeInTheDocument();
  view.rerender(<PatternsReply turn={turn({ ...input, query: '{app="new"}', start: '2026-11-20T09:00:00Z' })} />);
  expect(jest.mocked(SuspendedPatterns).mock.lastCall?.[0]).toMatchObject({
    query: '{app="new"}',
    timeRange: { raw: { from: '2026-11-20T09:00:00Z', to: input.end } },
  });
});

it.each([
  null,
  {},
  { ...input, datasource_uid: '' },
  { ...input, query: ' ' },
  { ...input, start: undefined },
  { ...input, start: 'invalid' },
  { ...input, end: 'invalid' },
  { ...input, start: input.end },
  { ...input, start: input.end, end: input.start },
  { ...input, query_type: 'instant' },
])('does not mount Patterns for invalid or unsupported tool input: %j', (value) => {
  render(<PatternsReply turn={turn(value)} />);
  expect(screen.getByText('Run a Loki log query with an explicit time range to show patterns.')).toBeInTheDocument();
  expect(SuspendedPatterns).not.toHaveBeenCalled();
});

it('handles older hosts without turn context', () => {
  expect(getLastAssistantLogsQuery(undefined)).toBeUndefined();
  render(<PatternsReply />);
  expect(SuspendedPatterns).not.toHaveBeenCalled();
});

it('keeps the request stable when Assistant recreates equivalent turn objects', () => {
  const view = render(<PatternsReply turn={turn()} />);
  const range = jest.mocked(SuspendedPatterns).mock.lastCall?.[0].timeRange;
  for (let index = 0; index < 5; index++) {
    view.rerender(<PatternsReply turn={turn({ ...input })} />);
    expect(jest.mocked(SuspendedPatterns).mock.lastCall?.[0].timeRange).toBe(range);
  }
});

it('registers the discoverable inline block contribution with model guidance', () => {
  const registration = getAssistantExtensionConfig(assistantExtensionManifest);
  expect(pluginJson.extensions.addedFunctions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: registration.title,
        description: registration.description,
        targets: expect.arrayContaining([registration.targets].flat()),
      }),
    ])
  );
  expect(assistantExtensionManifest.chits).toEqual([
    expect.objectContaining({
      kind: 'inline',
      name: 'patterns',
      component: SuspendedPatternsReply,
      selfClosing: true,
      display: 'block',
      prompt: expect.stringContaining('<grafana_lokiexplore_app_patterns />'),
    }),
  ]);
  expect(assistantExtensionManifest.artifactKinds).toBeUndefined();
  expect(assistantExtensionManifest.starters).toBeUndefined();
  expect(registration.fn()).toBe(assistantExtensionManifest);
});

it('initializes translations before rendering on a fresh Assistant page', async () => {
  let initialized = false;
  jest.mocked(t).mockImplementation((_key, fallback) => {
    if (!initialized) {
      throw new Error('Translations not initialized');
    }
    return fallback;
  });
  let initialize: () => void = () => {};
  jest.mocked(initI18n).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        initialize = () => {
          initialized = true;
          resolve();
        };
      })
  );
  render(<SuspendedPatternsReply turn={turn()} />);
  expect(screen.getByText('Loading Log Patterns...')).toBeInTheDocument();
  expect(initI18n).toHaveBeenCalledTimes(1);
  expect(SuspendedPatterns).not.toHaveBeenCalled();
  await act(async () => initialize());
  expect(await screen.findByText('Native Patterns')).toBeInTheDocument();
});
