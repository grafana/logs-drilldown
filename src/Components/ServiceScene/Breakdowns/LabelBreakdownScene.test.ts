import { AdHocFiltersVariable, sceneGraph, SceneObject } from '@grafana/scenes';

import { buildLabelsQuery } from '../../../services/labels';
import { VAR_FIELDS, VAR_LABEL_GROUP_BY_EXPR } from '../../../services/variables';

describe('buildLabelsQuery', () => {
  test('should build no-parser query with no filters', () => {
    const filterVariable = new AdHocFiltersVariable({
      filters: [],
      name: VAR_FIELDS,
    });
    jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(filterVariable);

    const result = buildLabelsQuery({} as SceneObject, VAR_LABEL_GROUP_BY_EXPR, 'cluster');
    expect(result).toMatchObject({
      expr: `sum(count_over_time({\${filters} ,cluster != ""}  \${levels} \${metadata} \${patterns} \${lineFilters}  \${fields} [$__auto])) by (${VAR_LABEL_GROUP_BY_EXPR})`,
    });
  });
  test('should build no-parser query with structured metadata filters', () => {
    const filterVariable = new AdHocFiltersVariable({
      filters: [
        {
          key: 'cluster',
          operator: '=',
          value: JSON.stringify({ parser: 'structuredMetadata', value: 'cluster-value' }),
        },
        {
          key: 'pod',
          operator: '=',
          value: JSON.stringify({ parser: 'structuredMetadata', value: 'pod-value' }),
        },
      ],
      name: VAR_FIELDS,
    });
    jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(filterVariable);

    const result = buildLabelsQuery({} as SceneObject, VAR_LABEL_GROUP_BY_EXPR, 'cluster');
    expect(result).toMatchObject({
      expr: `sum(count_over_time({\${filters} ,cluster != ""}  \${levels} \${metadata} \${patterns} \${lineFilters}  \${fields} [$__auto])) by (${VAR_LABEL_GROUP_BY_EXPR})`,
    });
  });
  test('should build logfmt-parser query with structured metadata filters', () => {
    const filterVariable = new AdHocFiltersVariable({
      filters: [
        {
          key: 'cluster',
          operator: '=',
          value: JSON.stringify({ parser: 'logfmt', value: 'cluster-value' }),
        },
        {
          key: 'pod',
          operator: '=',
          value: JSON.stringify({ parser: 'structuredMetadata', value: 'pod-value' }),
        },
      ],
      name: VAR_FIELDS,
    });
    jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(filterVariable);

    const result = buildLabelsQuery({} as SceneObject, VAR_LABEL_GROUP_BY_EXPR, 'cluster');
    expect(result).toMatchObject({
      expr: `sum(count_over_time({\${filters} ,cluster != ""}  \${levels} \${metadata} \${patterns} \${lineFilters} | logfmt  \${fields} [$__auto])) by (${VAR_LABEL_GROUP_BY_EXPR})`,
    });
  });
  test('should build json-parser query with structured metadata filters', () => {
    const filterVariable = new AdHocFiltersVariable({
      filters: [
        {
          key: 'cluster',
          operator: '=',
          value: JSON.stringify({ parser: 'json', value: 'cluster-value' }),
        },
        {
          key: 'pod',
          operator: '=',
          value: JSON.stringify({ parser: 'structuredMetadata', value: 'pod-value' }),
        },
      ],
      name: VAR_FIELDS,
    });
    jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(filterVariable);

    const result = buildLabelsQuery({} as SceneObject, VAR_LABEL_GROUP_BY_EXPR, 'cluster');
    expect(result).toMatchObject({
      expr: `sum(count_over_time({\${filters} ,cluster != ""}  \${levels} \${metadata} \${patterns} \${lineFilters} | json  \${jsonFields} | drop __error__, __error_details__  \${fields} [$__auto])) by (${VAR_LABEL_GROUP_BY_EXPR})`,
    });
  });
  test('should build mixed-parser query with structured metadata filters', () => {
    const filterVariable = new AdHocFiltersVariable({
      filters: [
        {
          key: 'cluster',
          operator: '=',
          value: JSON.stringify({ parser: 'logfmt', value: 'cluster-value' }),
        },
        {
          key: 'pod',
          operator: '=',
          value: JSON.stringify({ parser: 'structuredMetadata', value: 'pod-value' }),
        },
        {
          key: 'stacktrace',
          operator: '=',
          value: JSON.stringify({
            parser: 'json',
            value: JSON.stringify({ error: { level: 'critical', msg: 'oh no!' } }),
          }),
        },
      ],
      name: VAR_FIELDS,
    });
    jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(filterVariable);

    const result = buildLabelsQuery({} as SceneObject, VAR_LABEL_GROUP_BY_EXPR, 'cluster');
    expect(result).toMatchObject({
      expr: `sum(count_over_time({\${filters} ,cluster != ""}  \${levels} \${metadata} \${patterns} \${lineFilters} | json  \${jsonFields} | logfmt | drop __error__, __error_details__   \${fields} [$__auto])) by (${VAR_LABEL_GROUP_BY_EXPR})`,
    });
  });
});
