import { arrayToDataFrame, DataFrame, DataTopic, FieldType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import type { ComboboxOption } from '@grafana/ui';

import {
  extractFieldTypeFromString,
  extractParserFromString,
  getDetectedFieldsNamesField,
  getDetectedFieldsParserField,
  getDetectedFieldsTypeField,
} from './fields';
import { FIELDS_TO_REMOVE } from './filters';
import { getParserEnabled } from './parserToggle';

export const FIELD_EXTREME_ANNOTATION_NAME = 'Field extreme';

/** Finds the highest or lowest value across the time series frames, ignoring missing values. */
export function findExtremePoint(
  series: DataFrame[],
  aggregation: 'max' | 'min'
): { time: number; value: number } | undefined {
  let extreme: { time: number; value: number } | undefined;

  for (const frame of series) {
    const timeField = frame.fields.find((field) => field.type === FieldType.time);
    const valueField = frame.fields.find((field) => field.type === FieldType.number);
    if (!timeField || !valueField) {
      continue;
    }
    for (let i = 0; i < valueField.values.length; i++) {
      const value = valueField.values[i];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        continue;
      }
      const isMoreExtreme =
        aggregation === 'max' ? value > (extreme?.value ?? -Infinity) : value < (extreme?.value ?? Infinity);
      if (isMoreExtreme) {
        extreme = { time: timeField.values[i], value };
      }
    }
  }

  return extreme;
}

export function getExtremeValueFrame(time: number, text: string) {
  const frame = arrayToDataFrame([{ color: config.theme2.colors.warning.main, text, time }]);
  frame.name = FIELD_EXTREME_ANNOTATION_NAME;
  frame.meta = { dataTopic: DataTopic.Annotations };
  return frame;
}

const NUMERIC_TYPES = ['int', 'float', 'duration', 'bytes'];

/** Detected numeric fields first, then every other field since the detected type is only a guess. */
export function getFieldNames(detectedFieldsFrame: DataFrame | undefined): { numeric: string[]; other: string[] } {
  const namesField = getDetectedFieldsNamesField(detectedFieldsFrame);
  const parserField = getDetectedFieldsParserField(detectedFieldsFrame);
  const typesField = getDetectedFieldsTypeField(detectedFieldsFrame);
  const parserEnabled = getParserEnabled();
  const numeric = new Set<string>();
  const other = new Set<string>();

  namesField?.values.forEach((name, index) => {
    const fieldName = String(name);
    if (!fieldName || FIELDS_TO_REMOVE.includes(fieldName)) {
      return;
    }
    const type = extractFieldTypeFromString(typesField?.values?.[index]);
    if (type === 'boolean') {
      return;
    }
    if (!parserEnabled && extractParserFromString(parserField?.values?.[index] ?? '') !== 'structuredMetadata') {
      return;
    }
    (NUMERIC_TYPES.includes(type) ? numeric : other).add(fieldName);
  });

  return { numeric: [...numeric].sort(), other: [...other].sort() };
}

export function getFieldOptions(
  detectedFieldsFrame: DataFrame | undefined,
  selected?: string
): Array<ComboboxOption<string>> {
  const { numeric, other } = getFieldNames(detectedFieldsFrame);
  if (selected && !numeric.includes(selected) && !other.includes(selected)) {
    other.push(selected);
  }

  const numericGroup = t('components.service-scene.logs-volume.field-extremes.group-numeric', 'Numeric fields');
  const otherGroup = t('components.service-scene.logs-volume.field-extremes.group-other', 'Other fields');

  return [
    ...numeric.map((name) => ({ group: numericGroup, label: name, value: name })),
    ...other.map((name) => ({ group: otherGroup, label: name, value: name })),
  ];
}
