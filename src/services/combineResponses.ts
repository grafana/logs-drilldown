import {
  DataFrame,
  DataFrameType,
  DataQueryResponse,
  DataQueryResponseData,
  Field,
  FieldType,
  QueryResultMetaStat,
  shallowCompare,
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
 * Given two time-series data frames, merge their values with a linear two-pointer merge
 * (both time fields are assumed sorted ascending). A frame may carry multiple number fields
 * (e.g. several aggregations disambiguated by labels); each is matched between dest and
 * source by name, then by labels, falling back to positional index. Overlapping timestamps
 * have their number fields summed.
 */
export function mergeFrames(dest: DataFrame, source: DataFrame) {
  const destTimeField = dest.fields.find((field) => field.type === FieldType.time);
  const sourceTimeField = source.fields.find((field) => field.type === FieldType.time);

  if (!destTimeField || !sourceTimeField) {
    logger.error(new Error(`Time fields not found in the data frames`));
    return;
  }

  const destTime = destTimeField.values;
  const sourceTime = sourceTimeField.values;
  const totalFields = Math.max(dest.fields.length, source.fields.length);

  // Computed once, not per row.
  const fieldPairs = dest.fields.map((field, idx) => (field ? findSourceField(field, source.fields, idx) : undefined));
  const outValues: unknown[][] = dest.fields.map(() => []);

  const emitDest = (j: number) => {
    for (let f = 0; f < totalFields; f++) {
      if (!dest.fields[f]) {
        continue;
      }
      outValues[f].push(dest.fields[f].values[j]);
    }
  };

  const emitMerged = (j: number, i: number) => {
    for (let f = 0; f < totalFields; f++) {
      if (!dest.fields[f]) {
        continue;
      }
      const sourceField = fieldPairs[f];
      const destVal = dest.fields[f].values[j];
      let merged = destVal;
      if (sourceField) {
        if (dest.fields[f].type === FieldType.number) {
          merged = (destVal ?? 0) + sourceField.values[i];
        } else if (dest.fields[f].type !== FieldType.time) {
          merged = sourceField.values[i] ?? destVal;
        }
      }
      outValues[f].push(merged);
    }
  };

  const emitSource = (i: number) => {
    for (let f = 0; f < totalFields; f++) {
      if (!dest.fields[f]) {
        continue;
      }
      const sourceField = fieldPairs[f];
      outValues[f].push(sourceField ? sourceField.values[i] : undefined);
    }
  };

  let i = 0; // source pointer
  let j = 0; // dest pointer

  while (i < sourceTime.length && j < destTime.length) {
    if (destTime[j] === sourceTime[i]) {
      emitMerged(j, i);
      i++;
      j++;
    } else if (destTime[j] < sourceTime[i]) {
      emitDest(j);
      j++;
    } else {
      emitSource(i);
      i++;
    }
  }
  while (j < destTime.length) {
    emitDest(j);
    j++;
  }
  while (i < sourceTime.length) {
    emitSource(i);
    i++;
  }

  dest.fields.forEach((field, f) => {
    field.values = outValues[f];
  });
  dest.length = dest.fields[0].values.length;

  dest.meta = {
    ...dest.meta,
    stats: getCombinedMetadataStats(dest.meta?.stats ?? [], source.meta?.stats ?? []),
  };
}

function findSourceField(referenceField: Field, sourceFields: Field[], index: number) {
  const candidates = sourceFields.filter((f) => f.name === referenceField.name);

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (referenceField.labels) {
    return candidates.find((candidate) => shallowCompare(referenceField.labels ?? {}, candidate.labels ?? {}));
  }

  return sourceFields[index];
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
