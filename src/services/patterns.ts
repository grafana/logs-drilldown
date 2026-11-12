import { filter, firstValueFrom, from, fromEvent, takeUntil } from 'rxjs';

import {
  createDataFrame,
  DataFrame,
  DataQueryRequest,
  FieldColor,
  FieldType,
  generateUUID,
  LoadingState,
  TimeRange,
} from '@grafana/data';
import { Selector } from '@grafana/lezer-logql';
import { getDataSourceInstance } from '@grafana/plugin-compat/datasources';
import { config, DataSourceWithBackend } from '@grafana/runtime';

import { getNodesFromQuery } from './logqlMatchers';
import { LokiDatasource, LokiQuery } from './lokiQuery';
import { PLUGIN_ID } from './plugin';
import { buildDataQuery, LINE_LIMIT } from './query';
import { renderPatternFilters } from './renderPatternFilters';
import { getLevelsVariable } from './variableGetters';
import { VAR_PATTERNS_EXPR } from './variables';
import type { ServiceScene } from 'Components/ServiceScene/ServiceScene';

export type PatternFrame = {
  dataFrame: DataFrame;
  levels: string[];
  pattern: string;
  status?: 'exclude' | 'include';
  sum: number;
};

type SampleTimeStamp = number;
type SampleCount = number;
type PatternSample = [SampleTimeStamp, SampleCount];

export interface LokiPattern {
  level?: string;
  pattern: string;
  samples: PatternSample[];
}

export interface LokiPatternProcessed {
  levels: string[];
  samples: PatternSample[];
}

type PatternsResponse = {
  data: LokiPattern[];
};

export const MAX_PATTERNS_LIMIT = 500;

export async function getPatterns(
  ds: Pick<LokiDatasource, 'getResource'>,
  {
    query,
    range,
    step,
    requestId,
    refId,
  }: {
    query: string;
    range: TimeRange;
    refId?: string;
    requestId?: string;
    step?: string;
  }
) {
  const response = await ds.getResource<PatternsResponse>(
    'patterns',
    {
      start: range.from.toISOString(),
      end: range.to.toISOString(),
      query,
      ...(step ? { step } : {}),
    },
    {
      headers: { 'X-Query-Tags': `Source=${PLUGIN_ID}` },
      showErrorAlert: false,
      ...(requestId ? { requestId } : {}),
    }
  );

  const lokiPatterns = response?.data.slice(0, MAX_PATTERNS_LIMIT);

  const lokiPatternsProcessed: Record<string, LokiPatternProcessed> = {};

  lokiPatterns.forEach((pattern) => {
    if (lokiPatternsProcessed[pattern.pattern]) {
      if (pattern.level) {
        lokiPatternsProcessed[pattern.pattern].levels.push(pattern.level);
      }
      lokiPatternsProcessed[pattern.pattern].samples = mergeLokiSamples(
        pattern.samples,
        lokiPatternsProcessed[pattern.pattern].samples
      );
    } else {
      lokiPatternsProcessed[pattern.pattern] = {
        samples: pattern.samples,
        levels: pattern.level ? [pattern.level] : [],
      };
    }
  });

  const frames = Object.keys(lokiPatternsProcessed).map((key) => {
    const timeValues: number[] = [];
    const countValues: number[] = [];
    let sum = 0;
    const pattern = lokiPatternsProcessed[key];

    pattern.samples.forEach(([time, count]) => {
      timeValues.push(time * 1000);
      countValues.push(count);
      sum += count;
    });

    return createDataFrame({
      fields: [
        {
          config: {},
          name: 'time',
          type: FieldType.time,
          values: timeValues,
        },
        {
          config: {},
          name: key,
          type: FieldType.number,
          values: countValues,
        },
      ],
      meta: {
        custom: {
          sum,
          level: pattern.levels,
        },
        preferredVisualisationType: 'graph',
      },
      name: key,
      refId: refId ?? 'patterns',
    });
  });

  frames.sort((a, b) => (b.meta?.custom?.sum as number) - (a.meta?.custom?.sum as number));

  return frames;
}

// Merge counts by timestamp; Loki pattern samples may contain different timestamps.
export function mergeLokiSamples(s1: PatternSample[], s2: PatternSample[]) {
  const lokiSamplesMap = new Map<number, number>();
  s1.forEach((value) => {
    lokiSamplesMap.set(value[0], value[1]);
  });
  s2.forEach((value) => {
    if (lokiSamplesMap.has(value[0])) {
      const existingValue = lokiSamplesMap.get(value[0]);
      lokiSamplesMap.set(value[0], value[1] + (existingValue ?? 0));
    } else {
      lokiSamplesMap.set(value[0], value[1]);
    }
  });
  const samples = Array.from(lokiSamplesMap);
  samples.sort((a, b) => a[0] - b[0]);
  return samples;
}

export async function getPatternLogs(
  datasourceUid: string,
  query: string,
  pattern: string,
  range: TimeRange,
  signal: AbortSignal
) {
  const datasource = await getDataSourceInstance({ uid: datasourceUid });

  // Unsubscription cancels sample queries when the row closes or host inputs change.
  signal.throwIfAborted();

  const [selector] = getNodesFromQuery(query, [Selector]);

  if (!selector) {
    throw new Error('Expected a LogQL stream selector');
  }

  async function runQuery(expression: string) {
    const request: DataQueryRequest<LokiQuery> = {
      app: '',
      requestId: `pattern-samples-${generateUUID()}`,
      interval: '',
      intervalMs: 0,
      range,
      scopedVars: {},
      startTime: Date.now(),
      targets: [buildDataQuery(expression, { maxLines: LINE_LIMIT, datasource: { uid: datasourceUid } })],
      timezone: 'browser',
    };
    const result = await firstValueFrom(
      from(datasource.query(request)).pipe(
        filter((result) => result.state !== LoadingState.Loading && result.state !== LoadingState.Streaming),
        takeUntil(fromEvent(signal, 'abort'))
      )
    );

    if (result.errors?.length || result.state === LoadingState.Error) {
      throw result.errors?.[0] ?? new Error('Unable to load pattern logs');
    }

    return result.data;
  }

  const series = await runQuery(buildPatternLogsQuery(query, pattern));

  if (series.some((frame) => frame.length > 0)) {
    return { series, filtersOmitted: false };
  }

  const selectorQuery = query.slice(selector.from, selector.to);

  if (query.trim() === selectorQuery) {
    return { series, filtersOmitted: false };
  }

  return { series: await runQuery(buildPatternLogsQuery(selectorQuery, pattern)), filtersOmitted: true };
}

export function buildPatternLogsQuery(query: string, pattern: string, patternPlaceholder?: typeof VAR_PATTERNS_EXPR) {
  const patternFilter = renderPatternFilters([{ pattern, type: 'include' }]);

  // Scene queries replace a placeholder before interpolation; embedded queries already contain a concrete selector.
  if (patternPlaceholder) {
    return query.replace(patternPlaceholder, patternFilter);
  }

  const [selector] = getNodesFromQuery(query, [Selector]);

  if (!selector) {
    throw new Error('Expected a LogQL stream selector');
  }

  return `${query.slice(0, selector.to)} ${patternFilter}${query.slice(selector.to)}`;
}

export function getPatternsCount(serviceScene: ServiceScene) {
  const patternsData = serviceScene.state.$patternsData?.state.data?.series;
  if (!patternsData) {
    return 0;
  }

  let patterns = patternsData;

  const levelsVariable = getLevelsVariable(serviceScene);
  if (levelsVariable.state.filters.length > 0) {
    const levels = levelsVariable.state.filters.map((filter) => filter.value);
    patterns = patterns.filter((pattern) =>
      pattern.meta?.custom?.level?.some?.((level: string) => levels.includes(level))
    );
  }

  return patterns.length;
}

export async function getEmbededPatterns(datasourceUid: string, query: string, range: TimeRange, signal: AbortSignal) {
  const [selector] = getNodesFromQuery(query, [Selector]);

  if (!selector) {
    throw new Error('Expected a LogQL stream selector');
  }

  const ds = await getDataSourceInstance({ uid: datasourceUid });

  // Avoid starting a request if the inputs changed or the component unmounted during datasource lookup.
  signal.throwIfAborted();

  if (!(ds instanceof DataSourceWithBackend)) {
    throw new Error('A Loki backend datasource is required');
  }

  const frames = await getPatterns(ds, { query: query.slice(selector.from, selector.to), range });

  return frames.map((dataFrame, seriesIndex): PatternFrame => ({
    dataFrame: {
      ...dataFrame,
      fields: dataFrame.fields.map((field) =>
        field.type === FieldType.number
          ? { ...field, config: { ...field.config, color: overrideToFixedColor(seriesIndex) } }
          : field
      ),
    },
    pattern: dataFrame.name ?? '',
    sum: Number(dataFrame.meta?.custom?.sum ?? 0),
    levels: dataFrame.meta?.custom?.level ?? [],
  }));
}

export function overrideToFixedColor(index: number): FieldColor {
  const { palette } = config.theme2.visualization;
  return {
    fixedColor: palette[index % palette.length],
    mode: 'fixed',
  };
}
