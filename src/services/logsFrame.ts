import {
  arrayToDataFrame,
  DataFrame,
  DataFrameType,
  DataTopic,
  Field,
  FieldCache,
  FieldType,
  FieldWithIndex,
  Labels,
} from '@grafana/data';

// these are like Labels, but their values can be
// arbitrary structures, not just strings
export type LogFrameLabels = Record<string, unknown>;

// the attributes-access is a little awkward, but it's necessary
// because there are multiple,very different dataFrame-representations.
export type LogsFrame = {
  bodyField: FieldWithIndex;
  extraFields: FieldWithIndex[];
  // temporarily exists to make the labels=>attributes migration simpler
  getLabelFieldName: () => string | null;
  getLogFrameLabels: () => LogFrameLabels[] | null;
  // may be slow, so we only do it when asked for it explicitly
  getLogFrameLabelsAsLabels: () => Labels[] | null;
  idField: FieldWithIndex | null;
  raw: DataFrame;
  severityField: FieldWithIndex | null;
  timeField: FieldWithIndex;
  timeNanosecondField: FieldWithIndex | null;
};

function getField(cache: FieldCache, name: string, fieldType: FieldType): FieldWithIndex | undefined {
  const field = cache.getFieldByName(name);
  if (field === undefined) {
    return undefined;
  }

  return field.type === fieldType ? field : undefined;
}

export const DATAPLANE_TIMESTAMP_NAME = 'timestamp';
export const DATAPLANE_BODY_NAME_LEGACY = 'body';
export const DATAPLANE_LINE_NAME = 'Line';
export const DATAPLANE_SEVERITY_NAME = 'severity';
export const DATAPLANE_ID_NAME = 'id';
export const DATAPLANE_LABELS_NAME = 'labels';
export const DATAPLANE_LABEL_TYPES_NAME = 'labelTypes';

export function logFrameLabelsToLabels(logFrameLabels: LogFrameLabels): Labels {
  const result: Labels = {};

  Object.entries(logFrameLabels).forEach(([k, v]) => {
    result[k] = typeof v === 'string' ? v : JSON.stringify(v);
  });

  return result;
}

export function parseLogsFrame(frame: DataFrame): LogsFrame | null {
  if (frame.meta?.type === DataFrameType.LogLines) {
    return parseDataplaneLogsFrame(frame);
  } else {
    return parseLegacyLogsFrame(frame);
  }
}

export function parseDataplaneLogsFrame(frame: DataFrame): LogsFrame | null {
  const cache = new FieldCache(frame);

  const timestampField = getField(cache, DATAPLANE_TIMESTAMP_NAME, FieldType.time);
  const bodyField = getField(cache, DATAPLANE_BODY_NAME_LEGACY, FieldType.string);

  // these two are mandatory
  if (timestampField === undefined || bodyField === undefined) {
    return null;
  }

  const severityField = getField(cache, DATAPLANE_SEVERITY_NAME, FieldType.string) ?? null;
  const idField = getField(cache, DATAPLANE_ID_NAME, FieldType.string) ?? null;
  const labelsField = getField(cache, DATAPLANE_LABELS_NAME, FieldType.other) ?? null;

  const labels = labelsField === null ? null : labelsField.values;

  const extraFields = cache.fields.filter(
    (_, i) =>
      i !== timestampField.index &&
      i !== bodyField.index &&
      i !== severityField?.index &&
      i !== idField?.index &&
      i !== labelsField?.index
  );

  return {
    bodyField,
    extraFields,
    getLabelFieldName: () => (labelsField !== null ? labelsField.name : null),
    getLogFrameLabels: () => labels,
    getLogFrameLabelsAsLabels: () => (labels !== null ? labels.map(logFrameLabelsToLabels) : null),
    idField,
    raw: frame,
    severityField,
    timeField: timestampField,
    timeNanosecondField: null,
  };
}

// Copied from https://github.com/grafana/grafana/blob/main/public/app/features/logs/legacyLogsFrame.ts
export function parseLegacyLogsFrame(frame: DataFrame): LogsFrame | null {
  const cache = new FieldCache(frame);
  const timeField = cache.getFirstFieldOfType(FieldType.time);
  const bodyField = cache.getFirstFieldOfType(FieldType.string);

  // these two are mandatory
  if (timeField === undefined || bodyField === undefined) {
    return null;
  }

  const timeNanosecondField = cache.getFieldByName('tsNs') ?? null;
  const severityField = cache.getFieldByName('level') ?? null;
  const idField = cache.getFieldByName('id') ?? null;

  // extracting the labels is done very differently for old-loki-style and simple-style
  // dataframes, so it's a little awkward to handle it,
  // we both need to on-demand extract the labels, and also get teh labelsField,
  // but only if the labelsField is used.
  const [labelsField, getL] = makeLabelsGetter(cache, bodyField, frame);

  const extraFields = cache.fields.filter(
    (_, i) =>
      i !== timeField.index &&
      i !== bodyField.index &&
      i !== timeNanosecondField?.index &&
      i !== severityField?.index &&
      i !== idField?.index &&
      i !== labelsField?.index
  );

  return {
    bodyField,
    extraFields,
    getLabelFieldName: () => labelsField?.name ?? null,
    getLogFrameLabels: getL,
    getLogFrameLabelsAsLabels: getL,
    idField,
    raw: frame,
    severityField,
    timeField,
    timeNanosecondField,
  };
}

// if the frame has "labels" field with type "other", adjust the behavior.
// we also have to return the labels-field (if we used it),
// to be able to remove it from the unused-fields, later.
function makeLabelsGetter(
  cache: FieldCache,
  lineField: Field,
  frame: DataFrame
): [FieldWithIndex | null, () => Labels[] | null] {
  // If we have labels field with type "other", use that
  const labelsField = cache.getFieldByName('labels');
  if (labelsField !== undefined && labelsField.type === FieldType.other) {
    const values = labelsField.values.map(logFrameLabelsToLabels);
    return [labelsField, () => values];
  } else {
    // Otherwise we use the labels on the line-field, and make an array with it
    return [null, () => makeLabelsArray(lineField, frame.length)];
  }
}

// take the labels from the line-field, and "stretch" it into an array
// with the length of the frame (so there are the same labels for every row)
function makeLabelsArray(lineField: Field, length: number): Labels[] | null {
  const lineLabels = lineField.labels;
  if (lineLabels !== undefined) {
    const result = new Array(length);
    result.fill(lineLabels);
    return result;
  } else {
    return null;
  }
}

export function getTimeName(logsFrame?: LogsFrame) {
  return logsFrame?.timeField.name ?? DATAPLANE_TIMESTAMP_NAME;
}

export function getBodyName(logsFrame?: LogsFrame | null): string {
  return logsFrame?.bodyField.name ?? DATAPLANE_BODY_NAME_LEGACY;
}

export function getIdName(logsFrame?: LogsFrame): string {
  return logsFrame?.idField?.name ?? DATAPLANE_ID_NAME;
}

export function getSeriesVisibleRange(series: DataFrame[]) {
  let start = 0;
  let end = 0;

  const timeField = series[0]?.fields.find((field) => field.type === FieldType.time);
  if (timeField) {
    const values = [...timeField.values].sort();
    const oldestFirst = values[0] < values[values.length - 1];
    start = oldestFirst ? values[0] : values[values.length - 1];
    end = oldestFirst ? values[values.length - 1] : values[0];
  }
  return { end, start };
}

export const VISIBLE_RANGE_NAME = 'Visible range';
export function getVisibleRangeFrame(start: number, end: number) {
  const frame = arrayToDataFrame([
    {
      color: 'rgba(58, 113, 255, 0.3)',
      isRegion: true,
      text: 'Range from oldest to newest logs in display',
      time: start,
      timeEnd: end,
    },
  ]);
  frame.name = VISIBLE_RANGE_NAME;
  frame.meta = {
    dataTopic: DataTopic.Annotations,
  };

  return frame;
}

export function isEmptyLogsResult(series: DataFrame[]) {
  return series.length === 0 || series[0].fields[0].values.length === 0;
}
