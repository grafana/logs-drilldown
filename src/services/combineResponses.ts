import {
  closestIdx,
  DataFrame,
  DataFrameType,
  DataQueryResponse,
  DataQueryResponseData,
  Field,
  FieldType,
  QueryResultMetaStat,
} from '@grafana/data';

import { logger } from './logger';

export function combineResponses(currentResult: DataQueryResponse | null, newResult: DataQueryResponse) {
  if (!currentResult) {
    return cloneQueryResponse(newResult);
  }

  newResult.data.forEach((newFrame) => {
    const currentFrame = currentResult.data.find((frame) => shouldCombine(frame, newFrame));
    if (!currentFrame) {
      currentResult.data.push(cloneDataFrame(newFrame));
      return;
    }
    mergeFrames(currentFrame, newFrame);
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
  const mergedError = currentResult.error ?? newResult.error;
  if (mergedError != null) {
    currentResult.error = mergedError;
  }

  const mergedTraceIds = [...(currentResult.traceIds ?? []), ...(newResult.traceIds ?? [])];
  if (mergedTraceIds.length > 0) {
    currentResult.traceIds = mergedTraceIds;
  }

  return currentResult;
}

/**
 * Given two data frames, merge their values. Overlapping values will be added together.
 */
export function mergeFrames(dest: DataFrame, source: DataFrame) {
  const destTimeField = dest.fields.find((field) => field.type === FieldType.time);
  const destIdField = dest.fields.find((field) => field.type === FieldType.string && field.name === 'id');
  const sourceTimeField = source.fields.find((field) => field.type === FieldType.time);
  const sourceIdField = source.fields.find((field) => field.type === FieldType.string && field.name === 'id');

  if (!destTimeField || !sourceTimeField) {
    logger.error(new Error(`Time fields not found in the data frames`));
    return;
  }

  const sourceTimeValues = sourceTimeField?.values.slice(0) ?? [];
  const totalFields = Math.max(dest.fields.length, source.fields.length);

  for (let i = 0; i < sourceTimeValues.length; i++) {
    const destIdx = resolveIdx(destTimeField, sourceTimeField, i);

    const entryExistsInDest = compareEntries(destTimeField, destIdField, destIdx, sourceTimeField, sourceIdField, i);

    for (let f = 0; f < totalFields; f++) {
      // For now, skip undefined fields that exist in the new frame
      if (!dest.fields[f]) {
        continue;
      }
      // Index is not reliable when frames have disordered fields, or an extra/missing field, so we find them by name.
      // If the field has no name, we fallback to the old index version.
      const sourceField = findSourceField(dest.fields[f], source.fields, f);
      if (!sourceField) {
        continue;
      }
      // Same value, accumulate
      if (entryExistsInDest) {
        if (dest.fields[f].type === FieldType.time) {
          // Time already exists, skip
          continue;
        } else if (dest.fields[f].type === FieldType.number) {
          // Number, add
          dest.fields[f].values[destIdx] = (dest.fields[f].values[destIdx] ?? 0) + sourceField.values[i];
        } else if (dest.fields[f].type === FieldType.other) {
          // Possibly labels, combine
          if (typeof sourceField.values[i] === 'object') {
            dest.fields[f].values[destIdx] = {
              ...dest.fields[f].values[destIdx],
              ...sourceField.values[i],
            };
          } else if (sourceField.values[i] != null) {
            dest.fields[f].values[destIdx] = sourceField.values[i];
          }
        } else {
          // Replace value
          dest.fields[f].values[destIdx] = sourceField.values[i];
        }
      } else if (sourceField.values[i] !== undefined) {
        // Insert in the `destIdx` position
        dest.fields[f].values.splice(destIdx, 0, sourceField.values[i]);
        if (sourceField.nanos) {
          dest.fields[f].nanos = dest.fields[f].nanos ?? new Array(dest.fields[f].values.length - 1).fill(0);
          dest.fields[f].nanos?.splice(destIdx, 0, sourceField.nanos[i]);
        }
      }
    }
  }

  dest.length = dest.fields[0].values.length;

  dest.meta = {
    ...dest.meta,
    stats: getCombinedMetadataStats(dest.meta?.stats ?? [], source.meta?.stats ?? []),
  };
}

function resolveIdx(destField: Field, sourceField: Field, index: number) {
  const idx = closestIdx(sourceField.values[index], destField.values);
  if (idx < 0) {
    return 0;
  }
  if (sourceField.values[index] === destField.values[idx] && sourceField.nanos != null && destField.nanos != null) {
    return sourceField.nanos[index] > destField.nanos[idx] ? idx + 1 : idx;
  }
  if (sourceField.values[index] > destField.values[idx]) {
    return idx + 1;
  }
  return idx;
}

function compareEntries(
  destTimeField: Field,
  destIdField: Field | undefined,
  destIndex: number,
  sourceTimeField: Field,
  sourceIdField: Field | undefined,
  sourceIndex: number
) {
  const sameTimestamp = compareNsTimestamps(destTimeField, destIndex, sourceTimeField, sourceIndex);
  if (!sameTimestamp) {
    return false;
  }
  if (destIdField == null || sourceIdField == null) {
    return true;
  }
  // Log frames, check indexes
  return (
    destIdField.values[destIndex] !== undefined && destIdField.values[destIndex] === sourceIdField.values[sourceIndex]
  );
}

function compareNsTimestamps(destField: Field, destIndex: number, sourceField: Field, sourceIndex: number) {
  if (destField.nanos && sourceField.nanos) {
    return (
      destField.values[destIndex] !== undefined &&
      destField.values[destIndex] === sourceField.values[sourceIndex] &&
      destField.nanos[destIndex] !== undefined &&
      destField.nanos[destIndex] === sourceField.nanos[sourceIndex]
    );
  }
  return destField.values[destIndex] !== undefined && destField.values[destIndex] === sourceField.values[sourceIndex];
}

function findSourceField(referenceField: Field, sourceFields: Field[], index: number) {
  const candidates = sourceFields.filter((f) => f.name === referenceField.name);

  if (candidates.length === 1) {
    return candidates[0];
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

function shouldCombine(frame1: DataFrame, frame2: DataFrame): boolean {
  if (frame1.refId !== frame2.refId) {
    return false;
  }
  if (frame1.name != null && frame2.name != null && frame1.name !== frame2.name) {
    return false;
  }

  const frameType1 = frame1.meta?.type;
  const frameType2 = frame2.meta?.type;

  if (frameType1 !== frameType2) {
    // we do not join things that have a different type
    return false;
  }

  // metric range query data
  if (frameType1 === DataFrameType.TimeSeriesMulti) {
    return compareLabels(frame1, frame2);
  }

  // logs query data
  // logs use a special attribute in the dataframe's "custom" section
  // because we do not have a good "frametype" value for them yet.
  const customType1 = frame1.meta?.custom?.frameType;
  const customType2 = frame2.meta?.custom?.frameType;
  // Legacy frames have this custom type
  if (customType1 === 'LabeledTimeValues' && customType2 === 'LabeledTimeValues') {
    return true;
  } else if (customType1 === customType2) {
    // Data plane frames don't
    return true;
  }

  // should never reach here
  return false;
}

function compareLabels(frame1: DataFrame, frame2: DataFrame) {
  const field1 = frame1.fields.find((f) => f.type === FieldType.number);
  const field2 = frame2.fields.find((f) => f.type === FieldType.number);
  if (field1 === undefined || field2 === undefined) {
    // should never happen
    return false;
  }
  // undefined == null
  if (frame1.name == null) {
    frame1.name = JSON.stringify(field1.labels);
  }
  if (frame2.name == null) {
    frame2.name = JSON.stringify(field2.labels);
  }
  return frame1.name === frame2.name;
}
