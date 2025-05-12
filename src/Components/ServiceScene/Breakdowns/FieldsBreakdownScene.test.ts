import { createDataFrame, DataFrame, Field, FieldType } from '@grafana/data';
import { AdHocFiltersVariable } from '@grafana/scenes';

import {
  DETECTED_FIELDS_CARDINALITY_NAME,
  DETECTED_FIELDS_NAME_FIELD,
  DETECTED_FIELDS_PARSER_NAME,
  DETECTED_FIELDS_PATH_NAME,
  DETECTED_FIELDS_TYPE_NAME,
} from '../../../services/datasource';
import { buildFieldsQueryString } from '../../../services/fields';
import { VAR_FIELDS, VAR_METADATA } from '../../../services/variables';

describe('buildFieldsQueryString', () => {
  test('should build logfmt-parser query', () => {
    const filterVariable = new AdHocFiltersVariable({
      filters: [],
      name: VAR_FIELDS,
    });
    const nameField: Field = {
      config: {},
      name: DETECTED_FIELDS_NAME_FIELD,
      type: FieldType.string,
      values: ['caller'],
    };
    const cardinalityField: Field = {
      config: {},
      name: DETECTED_FIELDS_CARDINALITY_NAME,
      type: FieldType.number,
      values: [5],
    };
    const parserField: Field = {
      config: {},
      name: DETECTED_FIELDS_PARSER_NAME,
      type: FieldType.string,
      values: ['logfmt'],
    };
    const typeField: Field = {
      config: {},
      name: DETECTED_FIELDS_TYPE_NAME,
      type: FieldType.string,
      values: ['string'],
    };

    const detectedFieldsFrame: DataFrame = createDataFrame({
      fields: [nameField, cardinalityField, parserField, typeField],
    });

    const result = buildFieldsQueryString('caller', filterVariable, detectedFieldsFrame);
    expect(result).toEqual(
      `sum by (caller) (count_over_time({\${filters}}  \${levels} \${metadata} \${patterns} \${lineFilters} | logfmt | caller!="" \${fields} [$__auto]))`
    );
  });
  test('should build json-parser query', () => {
    const filterVariable = new AdHocFiltersVariable({
      filters: [],
      name: VAR_FIELDS,
    });

    const nameField: Field = {
      config: {},
      name: DETECTED_FIELDS_NAME_FIELD,
      type: FieldType.string,
      values: ['caller'],
    };
    const cardinalityField: Field = {
      config: {},
      name: DETECTED_FIELDS_CARDINALITY_NAME,
      type: FieldType.number,
      values: [5],
    };
    const parserField: Field = {
      config: {},
      name: DETECTED_FIELDS_PARSER_NAME,
      type: FieldType.string,
      values: ['json'],
    };
    const typeField: Field = {
      config: {},
      name: DETECTED_FIELDS_TYPE_NAME,
      type: FieldType.string,
      values: ['string'],
    };
    const jsonPath: Field = {
      config: {},
      name: DETECTED_FIELDS_PATH_NAME,
      type: FieldType.string,
      values: [['root', 'caller-path']],
    };

    const detectedFieldsFrame: DataFrame = createDataFrame({
      fields: [nameField, cardinalityField, parserField, typeField, jsonPath],
    });

    const result = buildFieldsQueryString('caller', filterVariable, detectedFieldsFrame);
    expect(result).toEqual(
      `sum by (caller) (count_over_time({\${filters}}  \${levels} \${metadata} \${patterns} \${lineFilters} | json caller="[\\"root\\"][\\"caller-path\\"]" \${jsonFields} | drop __error__, __error_details__ | caller!="" \${fields} [$__auto]))`
    );
  });
  test('should build mixed-parser query', () => {
    const filterVariable = new AdHocFiltersVariable({
      filters: [],
      name: VAR_FIELDS,
    });
    const nameField: Field = {
      config: {},
      name: DETECTED_FIELDS_NAME_FIELD,
      type: FieldType.string,
      values: ['caller'],
    };
    const cardinalityField: Field = {
      config: {},
      name: DETECTED_FIELDS_CARDINALITY_NAME,
      type: FieldType.number,
      values: [5],
    };
    const parserField: Field = {
      config: {},
      name: DETECTED_FIELDS_PARSER_NAME,
      type: FieldType.string,
      values: ['logfmt, json'],
    };
    const typeField: Field = {
      config: {},
      name: DETECTED_FIELDS_TYPE_NAME,
      type: FieldType.string,
      values: ['string'],
    };

    const detectedFieldsFrame: DataFrame = createDataFrame({
      fields: [nameField, cardinalityField, parserField, typeField],
    });

    const result = buildFieldsQueryString('caller', filterVariable, detectedFieldsFrame);
    expect(result).toEqual(
      `sum by (caller) (count_over_time({\${filters}}  \${levels} \${metadata} \${patterns} \${lineFilters} | json  \${jsonFields} | logfmt | drop __error__, __error_details__  | caller!="" \${fields} [$__auto]))`
    );
  });
  test('should build metadata query', () => {
    const metadataVariable = new AdHocFiltersVariable({
      filters: [],
      name: VAR_METADATA,
    });
    const nameField: Field = {
      config: {},
      name: DETECTED_FIELDS_NAME_FIELD,
      type: FieldType.string,
      values: ['caller'],
    };
    const cardinalityField: Field = {
      config: {},
      name: DETECTED_FIELDS_CARDINALITY_NAME,
      type: FieldType.number,
      values: [5],
    };
    const parserField: Field = {
      config: {},
      name: DETECTED_FIELDS_PARSER_NAME,
      type: FieldType.string,
      values: [''],
    };
    const typeField: Field = {
      config: {},
      name: DETECTED_FIELDS_TYPE_NAME,
      type: FieldType.string,
      values: ['string'],
    };

    const detectedFieldsFrame: DataFrame = createDataFrame({
      fields: [nameField, cardinalityField, parserField, typeField],
    });

    const result = buildFieldsQueryString('caller', metadataVariable, detectedFieldsFrame);
    expect(result).toEqual(
      `sum by (caller) (count_over_time({\${filters}} | caller!="" \${levels} \${metadata} \${patterns} \${lineFilters}  \${fields} [$__auto]))`
    );
  });
});
