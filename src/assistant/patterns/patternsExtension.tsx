import React, { lazy, Suspense, useMemo } from 'react';

import { dateMath } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, LoadingPlaceholder } from '@grafana/ui';

import type { AssistantExtensionManifest, InlineChitProps, InlineChitTurn } from 'assistant/extensionConfig';
import type { PatternsProps } from 'Components/ExposedComponents/Patterns/types';
import { initI18n, SuspendedPatterns } from 'services/extensions/exposedComponents';

interface LokiQuery {
  datasourceUid: string;
  end: string;
  query: string;
  start: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];

  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Latest `loki_query_handler` execute call in this turn. Later calls win. */
export function getLastAssistantLogsQuery(turn: InlineChitTurn | undefined): LokiQuery | undefined {
  const tools = turn?.tools ?? [];

  for (let index = tools.length - 1; index >= 0; index--) {
    const call = tools[index];
    if (!call || call.name !== 'loki_query_handler') {
      continue;
    }

    const input = call.input;
    if (!isRecord(input) || input.operation !== 'execute') {
      continue;
    }

    const datasourceUid = stringField(input, 'datasource_uid');
    const query = stringField(input, 'query');
    const start = stringField(input, 'start');
    const end = stringField(input, 'end');

    if (input.query_type !== 'range' || !datasourceUid || !query || !start || !end) {
      return;
    }

    return { datasourceUid, query, start, end };
  }

  return;
}

export function PatternsReply({ turn }: InlineChitProps) {
  const { datasourceUid, query, start, end } = getLastAssistantLogsQuery(turn) ?? {};
  const props = useMemo<PatternsProps | undefined>(() => {
    if (!datasourceUid || !query || !start || !end) {
      return;
    }

    const from = dateMath.toDateTime(start, {});
    const to = dateMath.toDateTime(end, { roundUp: true });
    if (!from?.isValid() || !to?.isValid() || from.valueOf() >= to.valueOf()) {
      return;
    }

    return { datasourceUid, query, timeRange: { from, to, raw: { from: start, to: end } } };
  }, [datasourceUid, query, start, end]);

  if (turn?.isStreaming) {
    return <LoadingPlaceholder text={t('assistant.patterns-loading', 'Loading Log Patterns...')} />;
  }

  if (!props) {
    return (
      <Alert
        severity="info"
        title={t(
          'assistant.patterns-query-required',
          'Run a Loki log query with an explicit time range to show patterns.'
        )}
      />
    );
  }

  return <SuspendedPatterns {...props} />;
}

const InitializedPatternsReply = lazy(async () => {
  await initI18n();
  return { default: PatternsReply };
});

export function SuspendedPatternsReply(props: InlineChitProps) {
  return (
    <Suspense
      fallback={
        <div>
          <Trans i18nKey="assistant.patterns-loading">Loading Log Patterns...</Trans>
        </div>
      }
    >
      <InitializedPatternsReply {...props} />
    </Suspense>
  );
}

const patternsChit = {
  kind: 'inline' as const,
  name: 'patterns',
  component: SuspendedPatternsReply,
  selfClosing: true,
  display: 'block' as const,
  prompt:
    'When the user asks to show or explore log patterns, render the live Log Patterns component instead of grouping sample log lines by hand. First use loki_query_handler with operation=execute, query_type=range, the Loki datasource_uid, the raw LogQL query, and explicit start/end timestamps for the requested range. Discover the datasource and service if needed; do not invent them. Then include <grafana_lokiexplore_app_patterns /> once on its own line, as HTML outside code fences. The component reads the latest Loki execute query in this turn and calls Loki pattern detection itself. Do not put query inputs on the tag or create an artifact. Patterns discovery uses indexed stream labels only; expanded logs retain query filters. Use this tag only for log patterns.',
};

export const assistantExtensionManifest: AssistantExtensionManifest = {
  schemaVersion: 1,
  chits: [patternsChit],
};
