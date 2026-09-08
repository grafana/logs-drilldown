import {
  DataFrame,
  DataFrameType,
  DataQueryResponse,
  DataQueryResponseData,
  Field,
  FieldType,
  QueryResultMetaStat,
} from '@grafana/data';

import { logger } from './logger';

function getFrameKey(frame: DataFrame): string {
  const field = frame.fields.find((f) => f.type === FieldType.number);
  if (!field) {
    throw new Error(`Unable to find number field on sharded dataframe!`);
  }

  if (!frame.name) {
    if (field.labels) {
      frame.name = (frame.refId ?? '') + JSON.stringify(field.labels);
    } else {
      if (!frame.refId) {
        throw new Error('Unable to find refId field on sharded dataframe!');
      }
      frame.name = frame.refId;
    }
  }
  return frame.name;
}

export function combineResponses(currentResult: DataQueryResponse | null, newResult: DataQueryResponse) {
  if (!currentResult) {
    return cloneQueryResponse(newResult);
  }

  const currentResultLabelsMap = new Map<string, DataFrame>();
  currentResult.data.forEach((frame: DataFrame) => {
    currentResultLabelsMap.set(getFrameKey(frame), frame);
  });

  newResult.data.forEach((newFrame: DataFrame) => {
    let currentFrame: DataFrame | undefined = undefined;
    const frameType = newFrame.meta?.type;
    if (frameType === DataFrameType.TimeSeriesMulti) {
      const key = getFrameKey(newFrame);

      if (currentResultLabelsMap.has(key)) {
        currentFrame = currentResultLabelsMap.get(key);
        mergeFrames(currentFrame!, newFrame);
      } else {
        currentResult.data.push(cloneDataFrame(newFrame));
      }
    } else {
      throw new Error(`Invalid data frame type: ${newFrame.meta?.type}`);
    }
  });

  const mergedErrors = [...(currentResult.errors ?? []), ...(newResult.errors ?? [])];

  // we make sure to have `.errors` as undefined, instead of empty-array
  // when no errors.

  if (mergedErrors.length > 0) {
    currentResult.errors = mergedErrors;
  }

  // the `.error` attribute is obsolete now,
  // but we have to maintain it, otherwise
  // some grafana parts do not behave well.
  // we just choose the old error, if it exists,
  // otherwise the new error, if it exists.
  /* eslint-disable-next-line @typescript-eslint/no-deprecated */
  const mergedError = currentResult.error ?? newResult.error;
  if (mergedError != null) {
    /* eslint-disable-next-line @typescript-eslint/no-deprecated */
    currentResult.error = mergedError;
  }

  const mergedTraceIds = [...(currentResult.traceIds ?? []), ...(newResult.traceIds ?? [])];
  if (mergedTraceIds.length > 0) {
    currentResult.traceIds = mergedTraceIds;
  }

  return currentResult;
}

/**
 * Given two time-series data frames (single time field + single number field),
 * merge their values with a linear two-pointer merge. Overlapping timestamps are summed.
 */
export function mergeFrames(dest: DataFrame, source: DataFrame) {
  const destTimeField = dest.fields.find((field) => field.type === FieldType.time);
  const destValueField = dest.fields.find((field) => field.type === FieldType.number);
  const sourceTimeField = source.fields.find((field) => field.type === FieldType.time);
  const sourceValueField = source.fields.find((field) => field.type === FieldType.number);

  if (!destTimeField || !sourceTimeField || !destValueField || !sourceValueField) {
    logger.error(new Error(`Time fields not found in the data frames`));
    return;
  }

  const destTime = destTimeField.values;
  const destValue = destValueField.values;
  const sourceTime = sourceTimeField.values;
  const sourceValue = sourceValueField.values;

  const mergedTime: number[] = [];
  const mergedValues: number[] = [];

  let i = 0; // source pointer
  let j = 0; // dest pointer

  while (i < sourceTime.length && j < destTime.length) {
    if (destTime[j] === sourceTime[i]) {
      mergedTime.push(destTime[j]);
      mergedValues.push((destValue[j] ?? 0) + (sourceValue[i] ?? 0));
      i++;
      j++;
    } else if (destTime[j] < sourceTime[i]) {
      mergedTime.push(destTime[j]);
      mergedValues.push(destValue[j]);
      j++;
    } else {
      mergedTime.push(sourceTime[i]);
      mergedValues.push(sourceValue[i]);
      i++;
    }
  }
  while (j < destTime.length) {
    mergedTime.push(destTime[j]);
    mergedValues.push(destValue[j]);
    j++;
  }
  while (i < sourceTime.length) {
    mergedTime.push(sourceTime[i]);
    mergedValues.push(sourceValue[i]);
    i++;
  }

  destTimeField.values = mergedTime;
  destValueField.values = mergedValues;

  dest.length = mergedTime.length;

  dest.meta = {
    ...dest.meta,
    stats: getCombinedMetadataStats(dest.meta?.stats ?? [], source.meta?.stats ?? []),
  };
}

const TOTAL_BYTES_STAT = 'Summary: total bytes processed';
// This is specific for Loki
function getCombinedMetadataStats(
  destStats: QueryResultMetaStat[],
  sourceStats: QueryResultMetaStat[]
): QueryResultMetaStat[] {
  // in the current approach, we only handle a single stat
  const destStat = destStats.find((s) => s.displayName === TOTAL_BYTES_STAT);
  const sourceStat = sourceStats.find((s) => s.displayName === TOTAL_BYTES_STAT);

  if (sourceStat != null && destStat != null) {
    return [{ displayName: TOTAL_BYTES_STAT, unit: destStat.unit, value: sourceStat.value + destStat.value }];
  }

  // maybe one of them exist
  const eitherStat = sourceStat ?? destStat;
  if (eitherStat != null) {
    return [eitherStat];
  }

  return [];
}

/**
 * Deep clones a DataQueryResponse
 */
export function cloneQueryResponse(response: DataQueryResponse): DataQueryResponse {
  const newResponse = {
    ...response,
    data: response.data.map(cloneDataFrame),
  };
  return newResponse;
}

function cloneDataFrame(frame: DataQueryResponseData): DataQueryResponseData {
  return {
    ...frame,
    fields: frame.fields.map((field: Field) => ({
      ...field,
      values: field.values,
    })),
  };
}
