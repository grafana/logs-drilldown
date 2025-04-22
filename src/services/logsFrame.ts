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
  LinkModel,
  LogRowModel,
  ScopedVars,
} from '@grafana/data';

// these are like Labels, but their values can be
// arbitrary structures, not just strings
export type LogFrameLabels = Record<string, unknown>;

// the attributes-access is a little awkward, but it's necessary
// because there are multiple,very different dataFrame-representations.
export type LogsFrame = {
  timeField: FieldWithIndex;
  bodyField: FieldWithIndex;
  timeNanosecondField: FieldWithIndex | null;
  severityField: FieldWithIndex | null;
  idField: FieldWithIndex | null;
  getLogFrameLabels: () => LogFrameLabels[] | null; // may be slow, so we only do it when asked for it explicitly
  getLogFrameLabelsAsLabels: () => Labels[] | null; // temporarily exists to make the labels=>attributes migration simpler
  getLabelFieldName: () => string | null;
  extraFields: FieldWithIndex[];
  raw: DataFrame;
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
    raw: frame,
    timeField: timestampField,
    bodyField,
    severityField,
    idField,
    getLogFrameLabels: () => labels,
    timeNanosecondField: null,
    getLogFrameLabelsAsLabels: () => (labels !== null ? labels.map(logFrameLabelsToLabels) : null),
    getLabelFieldName: () => (labelsField !== null ? labelsField.name : null),
    extraFields,
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
    timeField,
    bodyField,
    timeNanosecondField,
    severityField,
    idField,
    getLogFrameLabels: getL,
    getLogFrameLabelsAsLabels: getL,
    getLabelFieldName: () => labelsField?.name ?? null,
    extraFields,
    raw: frame,
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
  return { start, end };
}

export const VISIBLE_RANGE_NAME = 'Visible range';
export function getVisibleRangeFrame(start: number, end: number) {
  const frame = arrayToDataFrame([
    {
      time: start,
      timeEnd: end,
      isRegion: true,
      text: 'Range from oldest to newest logs in display',
      color: 'rgba(58, 113, 255, 0.3)',
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

export function getLogsExtractFields(dataFrame: DataFrame) {
  return dataFrame.fields
    .filter((field: Field & { typeInfo?: { frame: string } }) => {
      const isFieldLokiLabels =
        field.typeInfo?.frame === 'json.RawMessage' &&
        field.name === 'labels' &&
        dataFrame?.meta?.type !== DataFrameType.LogLines;
      const isFieldDataplaneLabels =
        field.name === 'labels' && field.type === FieldType.other && dataFrame?.meta?.type === DataFrameType.LogLines;
      return isFieldLokiLabels || isFieldDataplaneLabels;
    })
    .flatMap((field: Field) => {
      return [
        {
          id: 'extractFields',
          options: {
            format: 'json',
            keepTime: false,
            replace: false,
            source: field.name,
          },
        },
      ];
    });
}

export type GetFieldLinksFn = (
  field: Field,
  rowIndex: number,
  dataFrame: DataFrame,
  vars: ScopedVars
) => Array<LinkModel<Field>>;

export type FieldDef = {
  keys: string[];
  values: string[];
  links?: Array<LinkModel<Field>>;
  fieldIndex: number;
};

export const safeStringifyValue = (value: unknown, space?: number) => {
  if (value === undefined || value === null) {
    return '';
  }

  try {
    return JSON.stringify(value, null, space);
  } catch (error) {
    console.error(error);
  }

  return '';
};

/**
 * creates fields from the dataframe-fields, adding data-links, when field.config.links exists
 */
export const getDataframeFields = (row: LogRowModel, getFieldLinks?: GetFieldLinksFn): FieldDef[] => {
  const nonEmptyVisibleFields = getNonEmptyVisibleFields(row);
  return nonEmptyVisibleFields.map((field) => {
    const vars: ScopedVars = {
      __labels: {
        text: 'Labels',
        value: {
          tags: { ...row.labels },
        },
      },
    };
    const links = getFieldLinks ? getFieldLinks(field, row.rowIndex, row.dataFrame, vars) : [];
    const fieldVal = field.values[row.rowIndex];
    const outputVal =
      typeof fieldVal === 'string' || typeof fieldVal === 'number' ? fieldVal.toString() : safeStringifyValue(fieldVal);
    return {
      keys: [field.name],
      values: [outputVal],
      links: links,
      fieldIndex: field.index,
    };
  });
};

type VisOptions = {
  keepTimestamp?: boolean;
  keepBody?: boolean;
};

// Optimized version of separateVisibleFields() to only return visible fields for getAllFields()
function getNonEmptyVisibleFields(row: LogRowModel, opts?: VisOptions): FieldWithIndex[] {
  const frame = row.dataFrame;
  const visibleFieldIndices = getVisibleFieldIndices(frame, opts ?? {});
  const visibleFields: FieldWithIndex[] = [];
  for (let index = 0; index < frame.fields.length; index++) {
    const field = frame.fields[index];
    // ignore empty fields
    if (field.values[row.rowIndex] == null) {
      continue;
    }
    // hidden fields are always hidden
    if (field.config.custom?.hidden) {
      continue;
    }

    // fields with data-links are visible
    if ((field.config.links && field.config.links.length > 0) || visibleFieldIndices.has(index)) {
      visibleFields.push({ ...field, index });
    }
  }
  return visibleFields;
}

// return the fields (their indices to be exact) that should be visible
// based on the logs dataframe structure
function getVisibleFieldIndices(frame: DataFrame, opts: VisOptions): Set<number> {
  const logsFrame = parseLogsFrame(frame);
  if (logsFrame === null) {
    // should not really happen
    return new Set();
  }

  // we want to show every "extra" field
  const visibleFieldIndices = new Set(logsFrame.extraFields.map((f) => f.index));

  // we always show the severity field
  if (logsFrame.severityField !== null) {
    visibleFieldIndices.add(logsFrame.severityField.index);
  }

  if (opts.keepBody) {
    visibleFieldIndices.add(logsFrame.bodyField.index);
  }

  if (opts.keepTimestamp) {
    visibleFieldIndices.add(logsFrame.timeField.index);
  }

  return visibleFieldIndices;
}
