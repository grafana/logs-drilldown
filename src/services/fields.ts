import { map, Observable } from 'rxjs';

import { DataFrame, Field, ReducerID } from '@grafana/data';
import {
  AdHocFiltersVariable,
  PanelBuilders,
  SceneCSSGridItem,
  SceneDataTransformer,
  SceneObject,
} from '@grafana/scenes';
import { DrawStyle, StackingMode } from '@grafana/ui';

import { PanelMenu } from '../Components/Panels/PanelMenu';
import { SortBy, SortByScene } from '../Components/ServiceScene/Breakdowns/SortByScene';
import { getDetectedFieldsFrame } from '../Components/ServiceScene/ServiceScene';
import { LabelType } from './fieldsTypes';
import { logger } from './logger';
import {
  DATAPLANE_BODY_NAME_LEGACY,
  DATAPLANE_ID_NAME,
  DATAPLANE_LABEL_TYPES_NAME,
  DATAPLANE_LABELS_NAME,
  DATAPLANE_LINE_NAME,
} from './logsFrame';
import { getLabelTypeFromFrame } from './lokiQuery';
import { setLevelColorOverrides } from './panel';
import {
  getFieldsVariable,
  getJSONFieldsVariable,
  getLineFormatVariable,
  getLogsStreamSelector,
  getValueFromFieldsFilter,
} from './variableGetters';
import {
  DetectedFieldType,
  LEVEL_VARIABLE_VALUE,
  LogsQueryOptions,
  ParserType,
  VAR_FIELDS,
  VAR_LABELS,
  VAR_LEVELS,
  VAR_METADATA,
} from './variables';
import { AddToFiltersButton, InterpolatedFilterType } from 'Components/ServiceScene/Breakdowns/AddToFiltersButton';

export type DetectedLabel = {
  cardinality: number;
  label: string;
};

export type DetectedLabelsResponse = {
  detectedLabels: DetectedLabel[];
};

export type DetectedField = {
  cardinality: number;
  jsonPath: string[];
  label: string;
  parsers: string[] | null;
  type: string;
};

export type DetectedFieldsResponse = {
  fields: DetectedField[];
};

const getReducerId = (sortBy: SortBy) => {
  if (sortBy) {
    const values: string[] = Object.values(ReducerID);
    if (values.includes(sortBy)) {
      return sortBy;
    }
  }
  return undefined;
};

/**
 * Extracts the ExtractedFieldsType from the string returned on the detected_fields api parser field value
 * @param parserString
 */
export function extractParserFromString(parserString?: string): ParserType {
  switch (parserString) {
    case 'json':
      return 'json';
    case 'logfmt':
      return 'logfmt';
    case '': // Structured metadata is empty
      return 'structuredMetadata';
    case 'structuredMetadata': // Structured metadata is empty
      return 'structuredMetadata';
    default: // if we get a parser with multiple
      return 'mixed';
  }
}

export function extractFieldTypeFromString(fieldString?: string): DetectedFieldType {
  switch (fieldString) {
    case 'int':
    case 'float':
    case 'duration':
    case 'boolean':
    case 'bytes':
      return fieldString;
    default:
      return 'string';
  }
}

export function extractParserFromArray(parsers?: string[]): ParserType {
  const parsersSet = new Set(parsers?.map((v) => v.toString()) ?? []);

  // Structured metadata doesn't change the parser we use, so remove it
  parsersSet.delete('structuredMetadata');

  // get unique values
  const parsersArray = Array.from(parsersSet);

  if (parsersArray.length === 1) {
    return extractParserFromString(parsersArray[0]);
  }

  // If the set size is zero, we only had structured metadata detected as a parser
  if (parsersSet.size === 0) {
    return 'structuredMetadata';
  }

  // Otherwise if there was more then one value, return mixed parser
  return 'mixed';
}

export function getDetectedFieldsNamesField(detectedFieldsFrame?: DataFrame) {
  const namesField: Field<string> | undefined = detectedFieldsFrame?.fields[0];
  return namesField;
}
export function getDetectedFieldsCardinalityField(detectedFieldsFrame?: DataFrame) {
  const cardinalityField: Field<string> | undefined = detectedFieldsFrame?.fields[1];
  return cardinalityField;
}
export function getDetectedFieldsParserField(detectedFieldsFrame?: DataFrame) {
  const parserField: Field<string> | undefined = detectedFieldsFrame?.fields[2];
  return parserField;
}
export function getDetectedFieldsTypeField(detectedFieldsFrame?: DataFrame) {
  const parserField: Field<string> | undefined = detectedFieldsFrame?.fields[3];
  return parserField;
}
export function getDetectedFieldsJSONPathField(detectedFieldsFrame?: DataFrame) {
  const pathField: Field<string[]> | undefined = detectedFieldsFrame?.fields[4];
  return pathField;
}

export function getParserForField(fieldName: string, sceneRef: SceneObject): ParserType | undefined {
  const detectedFieldsFrame = getDetectedFieldsFrame(sceneRef);
  const parserField = getDetectedFieldsParserField(detectedFieldsFrame);
  const namesField = getDetectedFieldsNamesField(detectedFieldsFrame);

  const index = namesField?.values.indexOf(fieldName);
  const parser =
    index !== undefined && index !== -1 ? extractParserFromString(parserField?.values?.[index] ?? '') : undefined;

  if (parser === undefined) {
    logger.warn('missing parser, using mixed format for', { fieldName });
    return 'mixed';
  }
  return parser;
}

export function getParserAndPathForField(
  fieldName: string,
  sceneRef: SceneObject
): { parser: ParserType | undefined; path: string | undefined } {
  const detectedFieldsFrame = getDetectedFieldsFrame(sceneRef);
  const parserField = getDetectedFieldsParserField(detectedFieldsFrame);
  const namesField = getDetectedFieldsNamesField(detectedFieldsFrame);
  const pathField = getDetectedFieldsJSONPathField(detectedFieldsFrame);

  const index = namesField?.values.indexOf(fieldName);
  const parser =
    index !== undefined && index !== -1 ? extractParserFromString(parserField?.values?.[index] ?? '') : undefined;
  const pathArray = index !== undefined ? pathField?.values?.[index] : undefined;
  const path = pathArray ? getJsonPathArraySyntax(pathArray) : undefined;

  if (parser === undefined) {
    logger.warn('missing parser, using mixed format for', { fieldName });
    return {
      parser: 'mixed',
      path,
    };
  }
  return {
    parser,
    path,
  };
}

export function getFilterBreakdownValueScene(
  getTitle: (df: DataFrame) => string,
  style: DrawStyle,
  variableName: typeof VAR_FIELDS | typeof VAR_LABELS | typeof VAR_METADATA,
  sortByScene: SortByScene,
  labelKey?: string
) {
  return (frame: DataFrame, frameIndex: number) => {
    const reducerID = getReducerId(sortByScene.state.sortBy);
    const panel = PanelBuilders.timeseries()
      .setOption('legend', { showLegend: false })
      .setCustomFieldConfig('fillOpacity', 9)
      .setTitle(getTitle(frame))
      .setShowMenuAlways(true)
      .setData(
        new SceneDataTransformer({
          transformations: [() => selectFrameTransformation(frame)],
        })
      )
      .setOverrides(setLevelColorOverrides)
      .setMenu(new PanelMenu({ investigationOptions: { fieldName: getTitle(frame), frame, labelName: labelKey } }))
      .setHeaderActions([
        new AddToFiltersButton({ frame, hideExclude: labelKey === LEVEL_VARIABLE_VALUE, variableName }),
      ]);

    if (style === DrawStyle.Bars) {
      panel
        .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
        .setCustomFieldConfig('fillOpacity', 100)
        .setCustomFieldConfig('lineWidth', 0)
        .setCustomFieldConfig('pointSize', 0)
        .setOverrides(setLevelColorOverrides)
        .setCustomFieldConfig('drawStyle', DrawStyle.Bars);
    }

    if (reducerID) {
      panel.setOption('legend', {
        calcs: [reducerID],
        showLegend: true,
      });
      // These will only have a single series, no need to show the title twice
      panel.setDisplayName(' ');
    }

    return new SceneCSSGridItem({
      body: panel.build(),
    });
  };
}

export function selectFrameTransformation(frame: DataFrame) {
  return (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map(() => {
        return [frame];
      })
    );
  };
}

/**
 * Returns the variable to use when adding filters in a panel.
 * @param frame
 * @param key
 * @param sceneRef
 */
export function getVariableForLabel(
  frame: DataFrame | undefined,
  key: string,
  sceneRef: SceneObject
): InterpolatedFilterType {
  const labelType = frame ? getLabelTypeFromFrame(key, frame) : LabelType.Parsed;

  if (labelType) {
    // Use the labelType from the dataframe
    return getFilterTypeFromLabelType(labelType, key);
  }

  // If the dataframe doesn't have labelTypes, check if the detected_fields response returned a parser.
  const parserForThisField = getParserForField(key, sceneRef);
  if (parserForThisField === 'structuredMetadata') {
    return VAR_METADATA;
  }

  logger.warn('unable to determine label variable, falling back to parsed field', {
    key,
    parserForThisField: parserForThisField ?? '',
  });

  return VAR_FIELDS;
}

export function getFilterTypeFromLabelType(type: LabelType, key: string): InterpolatedFilterType {
  switch (type) {
    case LabelType.Indexed: {
      return VAR_LABELS;
    }
    case LabelType.Parsed: {
      return VAR_FIELDS;
    }
    case LabelType.StructuredMetadata: {
      // Structured metadata is either a special level variable, or a field variable
      if (key === LEVEL_VARIABLE_VALUE) {
        return VAR_LEVELS;
      }
      return VAR_METADATA;
    }
    default: {
      const err = new Error(`Invalid label type for ${key}`);
      logger.error(err, { msg: `Invalid label type for ${key}`, type });
      throw err;
    }
  }
}

export function getParserFromFieldsFilters(fields: AdHocFiltersVariable): ParserType {
  const parsers = fields.state.filters.map((filter) => {
    return getValueFromFieldsFilter(filter).parser;
  });

  return extractParserFromArray(parsers);
}

export function isAvgField(fieldType: DetectedFieldType | undefined) {
  return fieldType === 'duration' || fieldType === 'bytes' || fieldType === 'float';
}

export function buildFieldsQuery(optionValue: string, options: LogsQueryOptions) {
  if (options.fieldType && ['bytes', 'duration'].includes(options.fieldType)) {
    return (
      `avg_over_time(${getLogsStreamSelector(options)} | unwrap ` +
      options.fieldType +
      `(${optionValue}) | __error__="" [$__auto]) by (${options.aggregateByField})`
    );
  } else if (options.fieldType && options.fieldType === 'float') {
    return (
      `avg_over_time(${getLogsStreamSelector(options)} | unwrap ` +
      optionValue +
      ` | __error__="" [$__auto]) by (${options.aggregateByField})`
    );
  } else {
    return `sum by (${optionValue}${
      options.aggregateByField ? `,${options.aggregateByField}` : ''
    }) (count_over_time(${getLogsStreamSelector(options)} [$__auto]))`;
  }
}

/**
 * Returns the DetectedFieldType if available for a specific label
 * @param optionValue
 * @param detectedFieldsFrame
 */
export function getDetectedFieldType(optionValue: string, detectedFieldsFrame?: DataFrame) {
  const namesField = getDetectedFieldsNamesField(detectedFieldsFrame);
  const typesField = getDetectedFieldsTypeField(detectedFieldsFrame);
  const index = namesField?.values.indexOf(optionValue);
  return index !== undefined && index !== -1 ? extractFieldTypeFromString(typesField?.values?.[index]) : undefined;
}

export function buildFieldsQueryString(
  optionValue: string,
  fieldsVariable: AdHocFiltersVariable,
  detectedFieldsFrame?: DataFrame,
  jsonVariable?: AdHocFiltersVariable,
  aggregateByValue?: string
) {
  const namesField = getDetectedFieldsNamesField(detectedFieldsFrame);
  const typesField = getDetectedFieldsTypeField(detectedFieldsFrame);
  const parserField = getDetectedFieldsParserField(detectedFieldsFrame);
  const pathField = getDetectedFieldsJSONPathField(detectedFieldsFrame);
  const selectedFieldIndex = namesField?.values.indexOf(optionValue);
  const selectedAggregateFieldIndex = aggregateByValue ? namesField?.values.indexOf(aggregateByValue) : undefined;

  const parserForThisField =
    selectedFieldIndex !== undefined && selectedFieldIndex !== -1
      ? extractParserFromString(parserField?.values?.[selectedFieldIndex])
      : 'mixed';

  const parserForAggregateByField =
    selectedAggregateFieldIndex !== undefined && selectedFieldIndex !== -1
      ? extractParserFromString(parserField?.values?.[selectedAggregateFieldIndex])
      : 'mixed';

  const optionType =
    selectedFieldIndex !== undefined && selectedFieldIndex !== -1
      ? extractFieldTypeFromString(typesField?.values?.[selectedFieldIndex])
      : undefined;

  const pathForThisField =
    selectedFieldIndex !== undefined && selectedFieldIndex !== -1 ? pathField?.values?.[selectedFieldIndex] : undefined;

  // Get the parser from the json payload of each filter
  const parsers = fieldsVariable.state.filters.map((filter) => {
    const index = namesField?.values.indexOf(filter.key);
    const parserFromFilterValue = getValueFromFieldsFilter(filter);
    if (parserFromFilterValue.parser) {
      return parserFromFilterValue.parser;
    }

    // Then fallback to check the latest response
    const parser =
      index !== undefined && index !== -1
        ? extractParserFromString(parserField?.values?.[index] ?? 'mixed')
        : undefined;
    return parser ?? 'mixed';
  });

  const parser = extractParserFromArray([...parsers, parserForThisField, parserForAggregateByField]);

  let fieldExpressionToAdd = '';
  let structuredMetadataToAdd = '';

  if (parserForThisField === 'structuredMetadata') {
    structuredMetadataToAdd = `| ${optionValue}!=""`;
    // Structured metadata
  } else {
    fieldExpressionToAdd = `| ${optionValue}!=""`;
  }

  // is option structured metadata
  const options: LogsQueryOptions = {
    fieldExpressionToAdd,
    fieldType: optionType,
    parser: parser,
    structuredMetadataToAdd,
    aggregateByField: aggregateByValue,
  };

  if ((parser === 'json' || parser === 'mixed') && pathForThisField) {
    const jsonPath = getJsonPathArraySyntax(pathForThisField);
    const fieldFilters = fieldsVariable.state.filters;
    const jsonFilters = jsonVariable?.state.filters;
    // Only add JSON path args if every field filter already has a json parser prop
    if (fieldFilters.every((fieldFilter) => jsonFilters?.some((jsonFilter) => fieldFilter.key === jsonFilter.key))) {
      options.jsonParserPropToAdd = jsonVariable?.state.filters.length
        ? `${optionValue}="${jsonPath}",`
        : `${optionValue}="${jsonPath}"`;
    } else {
      logger.warn('missing json path for field filters', {
        fieldFilters: JSON.stringify(fieldFilters),
        jsonFilters: JSON.stringify(jsonFilters),
      });
    }
  }

  return buildFieldsQuery(optionValue, options);
}

// copied from /grafana/grafana/public/app/plugins/datasource/loki/datasource.ts:1204
export function lokiRegularEscape<T>(value: T) {
  if (typeof value === 'string') {
    return value.replace(/'/g, "\\\\'");
  }
  return value;
}

export function isLogLineField(fieldName: string) {
  return fieldName === DATAPLANE_LINE_NAME || fieldName === DATAPLANE_BODY_NAME_LEGACY;
}

export function isLabelsField(fieldName: string) {
  return fieldName === DATAPLANE_LABELS_NAME;
}

export function isLabelTypesField(fieldName: string) {
  return fieldName === DATAPLANE_LABEL_TYPES_NAME;
}

export function isLogsIdField(fieldName: string) {
  return fieldName === DATAPLANE_ID_NAME;
}

/**
 * Housekeeping: clears json parsers if there is not any field or line format filters
 */
export function clearJSONParserFields(sceneRef: SceneObject) {
  const fieldsVariable = getFieldsVariable(sceneRef);
  const jsonVar = getJSONFieldsVariable(sceneRef);
  const lineFormatVariable = getLineFormatVariable(sceneRef);

  // If there are no active filters, and no line format (drilldowns), clear the json
  if (!fieldsVariable.state.filters.length && !lineFormatVariable.state.filters.length) {
    jsonVar.setState({
      filters: [],
    });
  }
}

export function getJsonPathArraySyntax(path: string[]) {
  return path
    .map((path) => {
      return `[\\"${path}\\"]`;
    })
    ?.join('');
}
