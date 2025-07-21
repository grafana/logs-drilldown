import {
  Field,
  FieldType,
  getLinksSupplier,
  getTimeZone,
  LogsSortOrder,
  PanelData,
  sortDataFrame,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import {
  JSONDataFrameLabelsName,
  JSONDataFrameLineName,
  JSONDataFrameLinksName,
  JSONDataFrameStructuredMetadataName,
  JSONDataFrameTimeName,
  JSONLogsScene,
} from '../Components/ServiceScene/JSONLogsScene';
import { getLogsPanelFrame } from '../Components/ServiceScene/ServiceScene';
import { getJsonDerivedFieldsLinks } from './derivedFields';
import { isLabelsField, isLabelTypesField, isLogLineField } from './fields';
import { LabelType } from './fieldsTypes';
import { LABELS_TO_REMOVE } from './filters';
import { renderJSONVizTimeStamp } from './JSONViz';
import { getLineFormatVariable } from './variableGetters';

type ParsedJsonLogLineValue = string | string[] | Record<string, string> | Array<Record<string, string>>;
type ParsedJsonLogLine = Record<string, ParsedJsonLogLineValue> | Array<Record<string, string>>;

export function preProcessJSONDataFrame(panelData: PanelData, logsJsonScene: JSONLogsScene) {
  const rawFrame = getLogsPanelFrame(panelData);
  const dataFrame = rawFrame
    ? sortDataFrame(rawFrame, 1, logsJsonScene.state.sortOrder === LogsSortOrder.Descending)
    : undefined;
  const time = dataFrame?.fields.find((field) => field.type === FieldType.time);

  const labelsField: Field<Record<string, string>> | undefined = dataFrame?.fields.find(
    (field) => field.type === FieldType.other && isLabelsField(field.name)
  );
  const labelTypesField: Field<Record<string, LabelType>> | undefined = dataFrame?.fields.find(
    (field) => field.type === FieldType.other && isLabelTypesField(field.name)
  );

  const templateSrv = getTemplateSrv();
  const replace = templateSrv.replace.bind(templateSrv);

  const timeZone = getTimeZone();
  if (!dataFrame) {
    return {
      data: undefined,
      rawFrame: undefined,
    };
  }

  const isRerooted = getLineFormatVariable(logsJsonScene).state.filters.length > 0;
  const derivedFields: Field[] =
    dataFrame?.fields
      .filter((f) => f.config.links)
      .map((field) => ({ ...field, getLinks: getLinksSupplier(dataFrame, field, {}, replace) })) ?? [];

  const transformedData: PanelData = {
    ...panelData,
    series: [dataFrame].map((frame) => {
      return {
        ...frame,
        fields: frame.fields.map((field, frameIndex) => {
          if (isLogLineField(field.name)) {
            return {
              ...field,
              values: field.values
                .map((v, i) => {
                  let parsed;
                  try {
                    parsed = JSON.parse(v);
                  } catch (e) {
                    parsed = v;
                  }

                  const rawLabels = labelsField?.values?.[i];
                  const labelsTypes = labelTypesField?.values?.[i];
                  let structuredMetadata: Record<string, string> = {};
                  let indexedLabels: Record<string, string> = {};

                  if (!isRerooted && rawLabels && labelsTypes) {
                    const labelKeys = Object.keys(rawLabels);
                    labelKeys.forEach((label) => {
                      if (LABELS_TO_REMOVE.includes(label)) {
                      } else if (labelsTypes[label] === LabelType.StructuredMetadata) {
                        // @todo can structured metadata be JSON? detected_fields won't tell us if it were
                        structuredMetadata[label] = rawLabels[label];
                      } else if (labelsTypes[label] === LabelType.Indexed) {
                        indexedLabels[label] = rawLabels[label];
                      }
                    });
                  }
                  const line: ParsedJsonLogLine = {
                    [JSONDataFrameLineName]: parsed,
                    [JSONDataFrameTimeName]: renderJSONVizTimeStamp(time?.values?.[i], timeZone),
                  };
                  if (logsJsonScene.state.hasLabels && Object.keys(indexedLabels).length > 0) {
                    line[JSONDataFrameLabelsName] = indexedLabels;
                  }
                  if (logsJsonScene.state.hasMetadata && Object.keys(structuredMetadata).length > 0) {
                    line[JSONDataFrameStructuredMetadataName] = structuredMetadata;
                  }
                  if (derivedFields !== undefined) {
                    let jsonLinks = getJsonDerivedFieldsLinks(derivedFields, i);
                    if (Object.keys(jsonLinks).length) {
                      line[JSONDataFrameLinksName] = jsonLinks;
                    }
                  }
                  return line;
                })
                .filter((f) => f),
            };
          }
          return field;
        }),
      };
    }),
  };

  return {
    data: transformedData,
    rawFrame: dataFrame,
  };
}
