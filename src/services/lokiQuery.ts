// Warning: This file (and any imports) are included in the main bundle with Grafana in order to provide link extension support in Grafana core, in an effort to keep Grafana loading quickly, please do not add any unnecessary imports to this file and run the bundle analyzer before committing any changes!
import { DataSourceRef } from '@grafana/schema';
import { DataSourceWithBackend } from '@grafana/runtime';
import { DataFrame, DataSourceJsonData, ScopedVars, TimeRange } from '@grafana/data';
import { LabelType } from './fieldsTypes';

export enum LokiQueryDirection {
  Backward = 'backward',
  Forward = 'forward',
  Scan = 'scan',
}

export type LokiQuery = {
  refId: string;
  queryType?: LokiQueryType;
  editorMode?: string;
  supportingQueryType?: string;
  expr: string;
  legendFormat?: string;
  splitDuration?: string;
  datasource?: DataSourceRef;
  maxLines?: number;
  direction?: LokiQueryDirection;
  step?: string;
};

export type LokiQueryType = 'instant' | 'range' | 'stream' | string;

export type LokiDatasource = DataSourceWithBackend<LokiQuery, DataSourceJsonData> & {
  maxLines?: number;
} & {
  // @todo delete after min supported grafana is upgraded to >=11.6
  interpolateString?: (string: string, scopedVars?: ScopedVars) => string;
  getTimeRangeParams: (timeRange: TimeRange) => { start: number; end: number };
};

export function getLabelTypeFromFrame(labelKey: string, frame: DataFrame, index = 0): null | LabelType {
  const typeField = frame.fields.find((field) => field.name === 'labelTypes')?.values[index];
  if (!typeField) {
    return null;
  }
  switch (typeField[labelKey]) {
    case 'I':
      return LabelType.Indexed;
    case 'S':
      return LabelType.StructuredMetadata;
    case 'P':
      return LabelType.Parsed;
    default:
      return null;
  }
}
