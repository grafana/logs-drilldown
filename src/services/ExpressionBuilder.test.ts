import { AdHocVariableFilter } from '@grafana/data';
import { AdHocFiltersVariable, AdHocFilterWithLabels } from '@grafana/scenes';

import { ExpressionBuilder } from './ExpressionBuilder';
import { FilterOp } from './filterTypes';
import { renderLogQLFieldFilters, renderLogQLLabelFilters, renderLogQLMetadataFilters } from './query';
import { addAdHocFilterUserInputPrefix, FieldValue } from './variables';

describe('renderLogQLFieldFilters', () => {
  test('Renders positive filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'info',
        } as FieldValue),
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'lil-cluster',
        } as FieldValue),
      },
    ];
    expect(renderLogQLFieldFilters(filters)).toEqual('| level="info" | cluster="lil-cluster"');
  });
  test('Renders negative filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.NotEqual,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'info',
        } as FieldValue),
      },
      {
        key: 'cluster',
        operator: FilterOp.NotEqual,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'lil-cluster',
        } as FieldValue),
      },
      {
        key: 'cluster',
        operator: FilterOp.NotEqual,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'lil-cluster-2',
        } as FieldValue),
      },
      {
        key: 'filename',
        operator: FilterOp.NotEqual,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'C:\\Grafana\\logs\\logs.txt',
        } as FieldValue),
      },
      {
        key: 'pod',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'pod-1',
        } as FieldValue),
      },
      {
        key: 'pod',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'pod-2',
        } as FieldValue),
      },
    ];

    expect(renderLogQLFieldFilters(filters)).toEqual(
      '| pod="pod-1" or pod="pod-2" | level!="info" | cluster!="lil-cluster" | cluster!="lil-cluster-2" | filename!="C:\\\\Grafana\\\\logs\\\\logs.txt"'
    );
  });
  test('Groups positive filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'info',
        } as FieldValue),
      },
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'error',
        } as FieldValue),
      },
    ];

    expect(renderLogQLFieldFilters(filters)).toEqual('| level="info" or level="error"');
  });
  test('Renders grouped and ungrouped positive and negative filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'info',
        } as FieldValue),
      },
      {
        key: 'component',
        operator: FilterOp.NotEqual,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'comp1',
        } as FieldValue),
      },
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'error',
        } as FieldValue),
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'lil-cluster',
        } as FieldValue),
      },
      {
        key: 'pod',
        operator: FilterOp.NotEqual,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'pod1',
        } as FieldValue),
      },
    ];

    expect(renderLogQLFieldFilters(filters)).toEqual(
      '| level="info" or level="error" | cluster="lil-cluster" | component!="comp1" | pod!="pod1"'
    );
  });
  test('Renders positive regex filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.RegexEqual,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'info',
        } as FieldValue),
      },
      {
        key: 'cluster',
        operator: FilterOp.RegexEqual,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'lil"-cluster',
        } as FieldValue),
      },
    ];

    // Filters do not yet support regex operators
    expect(renderLogQLFieldFilters(filters)).toEqual('| level=~"info" | cluster=~"lil\\"-cluster"');
  });
  test('Escapes regex', () => {
    const filters: AdHocFilterWithLabels[] = [
      {
        key: 'host',
        operator: FilterOp.RegexEqual,
        value: addAdHocFilterUserInputPrefix(
          JSON.stringify({
            parser: 'logfmt',
            value: '((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}',
          } as FieldValue)
        ),
      },
      {
        key: 'level',
        operator: FilterOp.RegexEqual,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'error',
        } as FieldValue),
      },
    ];

    expect(renderLogQLFieldFilters(filters)).toEqual(
      '| host=~"((25[0-5]|(2[0-4]|1\\\\d|[1-9]|)\\\\d)\\\\.?\\\\b){4}" | level=~"error"'
    );
  });
  test('Renders negative regex filters', () => {
    const filters: AdHocFilterWithLabels[] = [
      {
        key: 'level',
        operator: FilterOp.RegexNotEqual,
        value: addAdHocFilterUserInputPrefix(
          JSON.stringify({
            parser: 'logfmt',
            value: 'in.+',
          } as FieldValue)
        ),
      },
      {
        key: 'level',
        operator: FilterOp.RegexNotEqual,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'info',
        } as FieldValue),
      },
      {
        key: 'cluster',
        operator: FilterOp.RegexNotEqual,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'lil-cluster',
        } as FieldValue),
      },
    ];

    expect(renderLogQLFieldFilters(filters)).toEqual('| level!~"in.+" | level!~"info" | cluster!~"lil-cluster"');
  });
  test('Renders lte && gt numeric filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'duration',
        operator: FilterOp.lte,
        value: JSON.stringify({
          parser: 'logfmt',
          value: '20s',
        } as FieldValue),
      },
      {
        key: 'duration',
        operator: FilterOp.gt,
        value: JSON.stringify({
          parser: 'logfmt',
          value: '10s',
        } as FieldValue),
      },
      {
        key: 'level',
        operator: FilterOp.RegexNotEqual,
        value: addAdHocFilterUserInputPrefix(
          JSON.stringify({
            parser: 'logfmt',
            value: 'in.+',
          } as FieldValue)
        ),
      },
    ];
    expect(renderLogQLFieldFilters(filters)).toEqual('| level!~"in.+" | duration<=20s | duration>10s');
  });
  test('Renders lt && gte numeric filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'duration',
        operator: FilterOp.lt,
        value: JSON.stringify({
          parser: 'logfmt',
          value: '20s',
        } as FieldValue),
      },
      {
        key: 'duration',
        operator: FilterOp.gte,
        value: JSON.stringify({
          parser: 'logfmt',
          value: '10s',
        } as FieldValue),
      },
      {
        key: 'file',
        operator: FilterOp.RegexNotEqual,
        value: JSON.stringify({
          parser: 'logfmt',
          value: 'C:\\grafana\\dir\\file.txt',
        } as FieldValue),
      },
    ];
    expect(renderLogQLFieldFilters(filters)).toEqual(
      '| file!~"C:\\\\\\\\grafana\\\\\\\\dir\\\\\\\\file\\\\.txt" | duration<20s | duration>=10s'
    );
  });
  test('Empty quote is not escaped', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'bytes',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          parser: 'logfmt',
          value: '""',
        } as FieldValue),
      },
    ];
    expect(renderLogQLFieldFilters(filters)).toEqual('| bytes=""');
  });
});

describe('renderLogQLLabelFilters', () => {
  describe('excluding keys', () => {
    it('should not remove the only include filter', () => {
      const filters: AdHocVariableFilter[] = [
        {
          key: 'service',
          operator: FilterOp.Equal,
          value: 'service-1',
        },
      ];

      expect(renderLogQLLabelFilters(filters, ['service'])).toEqual('service="service-1"');
    });
    it('should remove filters matching ignore keys', () => {
      const filters: AdHocVariableFilter[] = [
        {
          key: 'service',
          operator: FilterOp.Equal,
          value: 'service-1',
        },
        {
          key: 'cluster',
          operator: FilterOp.Equal,
          value: 'us-east-1',
        },
      ];

      expect(renderLogQLLabelFilters(filters, ['cluster'])).toEqual('service="service-1"');
    });
  });
  test('Renders positive filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'info',
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: 'lil-cluster',
      },
      {
        key: 'filename',
        operator: FilterOp.Equal,
        value: 'C:\\Grafana\\logs\\logs.txt',
      },
      {
        key: 'host',
        operator: FilterOp.RegexEqual,
        value: addAdHocFilterUserInputPrefix(`((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`),
      },
    ];
    expect(renderLogQLLabelFilters(filters)).toEqual(
      'level="info", cluster="lil-cluster", filename="C:\\\\Grafana\\\\logs\\\\logs.txt", host=~"((25[0-5]|(2[0-4]|1\\\\d|[1-9]|)\\\\d)\\\\.?\\\\b){4}"'
    );
  });
  test('Renders negative filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.NotEqual,
        value: 'info',
      },
      {
        key: 'cluster',
        operator: FilterOp.NotEqual,
        value: 'lil-cluster',
      },
      {
        key: 'cluster',
        operator: FilterOp.NotEqual,
        value: 'lil-cluster-2',
      },
      {
        key: 'filename',
        operator: FilterOp.NotEqual,
        value: 'C:\\Grafana\\logs\\logs.txt',
      },
      {
        key: 'pod',
        operator: FilterOp.Equal,
        value: 'pod-1',
      },
      {
        key: 'pod',
        operator: FilterOp.Equal,
        value: 'pod-2',
      },
    ];

    expect(renderLogQLLabelFilters(filters)).toEqual(
      'level!="info", filename!="C:\\\\Grafana\\\\logs\\\\logs.txt", pod=~"pod-1|pod-2", cluster!~"lil-cluster|lil-cluster-2"'
    );
  });
  test('Groups positive filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'filename',
        operator: FilterOp.Equal,
        value: '/var/log/apache2/apache.log',
      },
      {
        key: 'filename',
        operator: FilterOp.Equal,
        value: '/var/log/nginx/nginx.log',
      },
      {
        key: 'filename',
        operator: FilterOp.Equal,
        value: 'C:\\Grafana\\logs\\logs.txt',
      },
    ];

    expect(renderLogQLLabelFilters(filters)).toEqual(
      'filename=~"/var/log/apache2/apache\\\\.log|/var/log/nginx/nginx\\\\.log|C:\\\\\\\\Grafana\\\\\\\\logs\\\\\\\\logs\\\\.txt"'
    );
  });
  test('Groups positive regex filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'filename',
        operator: FilterOp.RegexEqual,
        value: 'C:\\Grafana\\logs\\logs3.txt',
      },
      {
        key: 'filename',
        operator: FilterOp.RegexEqual,
        value: 'C:\\Grafana\\logs\\logs2.txt',
      },
    ];

    expect(renderLogQLLabelFilters(filters)).toEqual(
      'filename=~"C:\\\\\\\\Grafana\\\\\\\\logs\\\\\\\\logs3\\\\.txt|C:\\\\\\\\Grafana\\\\\\\\logs\\\\\\\\logs2\\\\.txt"'
    );
  });
  test('Groups negative regex filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.RegexNotEqual,
        value: 'info',
      },
      {
        key: 'level',
        operator: FilterOp.RegexNotEqual,
        value: 'error',
      },
    ];

    expect(renderLogQLLabelFilters(filters)).toEqual('level!~"info|error"');
  });
  test('Doesnt mix negative and positive regex filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.RegexEqual,
        value: 'info',
      },
      {
        key: 'level',
        operator: FilterOp.RegexNotEqual,
        value: 'error',
      },
    ];

    expect(renderLogQLLabelFilters(filters)).toEqual('level=~"info", level!~"error"');
  });
  test('Renders grouped and ungrouped positive and negative filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'info',
      },
      {
        key: 'component',
        operator: FilterOp.NotEqual,
        value: 'comp1',
      },
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'error',
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: 'lil-cluster',
      },
      {
        key: 'pod',
        operator: FilterOp.NotEqual,
        value: 'pod1',
      },
    ];

    expect(renderLogQLLabelFilters(filters)).toEqual(
      'cluster="lil-cluster", component!="comp1", pod!="pod1", level=~"info|error"'
    );
  });
});

describe('getJoinedLabelsFilters', () => {
  function joinTagFilters(adHoc: AdHocFiltersVariable) {
    const filterTransformer = new ExpressionBuilder(adHoc.state.filters);
    return filterTransformer.getJoinedLabelsFilters();
  }

  it('escapes special chars', () => {
    const adHoc = new AdHocFiltersVariable({
      filters: [
        {
          key: 'file',
          operator: '=',
          value: 'C:\\Grafana\\Logs\\log.txt',
        },
      ],
    });

    const result = joinTagFilters(adHoc);
    expect(result).toEqual([
      {
        key: 'file',
        operator: '=',
        value: 'C:\\\\Grafana\\\\Logs\\\\log.txt',
      },
    ]);
  });
  it('escapes special chars with regex selector', () => {
    const adHoc = new AdHocFiltersVariable({
      filters: [
        {
          key: 'file',
          operator: '=~',
          value: 'C:\\Grafana\\Logs\\log.txt',
        },
      ],
    });

    const result = joinTagFilters(adHoc);
    expect(result).toEqual([
      {
        key: 'file',
        operator: '=~',
        value: 'C:\\\\\\\\Grafana\\\\\\\\Logs\\\\\\\\log\\\\.txt',
      },
    ]);
  });
  it('joins multiple include', () => {
    const adHoc = new AdHocFiltersVariable({
      filters: [
        {
          key: 'filename',
          operator: '=',
          value: 'C:\\Grafana\\logs\\logs.txt',
        },
        {
          key: 'filename',
          operator: '=',
          value: 'C:\\Grafana\\logs\\logs2.txt',
        },
        {
          key: 'filename_2',
          operator: '=',
          value: 'C:\\Grafana\\more-logs\\logs2.txt',
        },
      ],
    });

    const result = joinTagFilters(adHoc);
    expect(result).toEqual([
      {
        key: 'filename_2',
        operator: '=',
        value: 'C:\\\\Grafana\\\\more-logs\\\\logs2.txt',
      },
      {
        key: 'filename',
        operator: '=~',
        value: 'C:\\\\\\\\Grafana\\\\\\\\logs\\\\\\\\logs\\\\.txt|C:\\\\\\\\Grafana\\\\\\\\logs\\\\\\\\logs2\\\\.txt',
      },
    ]);
  });
  it('joins multiple exclude', () => {
    const filters = [
      {
        key: 'not_service_name',
        operator: '=',
        value: 'not_service_name_value',
      },
      {
        key: 'service_name',
        operator: '!=',
        value: 'service_value',
      },
      {
        key: 'service_name',
        operator: '!=',
        value: 'service_value_2',
      },
    ];

    const adHoc = new AdHocFiltersVariable({
      filters,
    });

    const result = joinTagFilters(adHoc);
    expect(result).toEqual([
      {
        key: 'not_service_name',
        operator: '=',
        value: 'not_service_name_value',
      },
      {
        key: 'service_name',
        operator: '!~',
        value: 'service_value|service_value_2',
      },
    ]);
  });
  it('joins multiple include with user-input regex', () => {
    const adHoc = new AdHocFiltersVariable({
      filters: [
        {
          key: 'service_name',
          operator: '=~',
          value: addAdHocFilterUserInputPrefix(`service_value.+`),
        },
        {
          key: 'service_name',
          operator: '=~',
          value: addAdHocFilterUserInputPrefix(`service_value_2$`),
        },
        {
          key: 'not_service_name',
          operator: '=',
          value: 'C:\\Grafana Logs\\logfile.txt',
        },
      ],
    });

    const result = joinTagFilters(adHoc);
    expect(result).toEqual([
      {
        key: 'not_service_name',
        operator: '=',
        value: 'C:\\\\Grafana Logs\\\\logfile.txt',
      },
      {
        key: 'service_name',
        operator: '=~',
        value: `service_value.+|service_value_2$`,
      },
    ]);
  });
  it('joins multiple exclude with regex', () => {
    const filters = [
      {
        key: 'not_service_name',
        operator: '!~',
        value: 'not_service_name_value',
      },
      {
        key: 'service_name',
        operator: '!~',
        value: 'service_value',
      },
      {
        key: 'service_name',
        operator: '!~',
        value: 'service_value_2',
      },
    ];

    const adHoc = new AdHocFiltersVariable({
      filters,
    });

    const result = joinTagFilters(adHoc);
    expect(result).toEqual([
      {
        key: 'not_service_name',
        operator: '!~',
        value: 'not_service_name_value',
      },
      {
        key: 'service_name',
        operator: '!~',
        value: 'service_value|service_value_2',
      },
    ]);
  });
});

describe('renderLogQLMetadataFilters', () => {
  test('Renders positive filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'info',
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: 'lil"-cluster',
      },
    ];

    expect(renderLogQLMetadataFilters(filters)).toEqual('| level="info" | cluster="lil\\"-cluster"');
  });
  test('Renders negative filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.NotEqual,
        value: 'info',
      },
      {
        key: 'cluster',
        operator: FilterOp.NotEqual,
        value: 'lil-cluster',
      },
      {
        key: 'cluster',
        operator: FilterOp.NotEqual,
        value: 'lil-cluster-2',
      },
      {
        key: 'filename',
        operator: FilterOp.NotEqual,
        value: 'C:\\Grafana\\logs\\logs.txt',
      },
      {
        key: 'pod',
        operator: FilterOp.Equal,
        value: 'pod-1',
      },
      {
        key: 'pod',
        operator: FilterOp.Equal,
        value: 'pod-2',
      },
    ];

    expect(renderLogQLMetadataFilters(filters)).toEqual(
      '| pod="pod-1" or pod="pod-2" | level!="info" | cluster!="lil-cluster" | cluster!="lil-cluster-2" | filename!="C:\\\\Grafana\\\\logs\\\\logs.txt"'
    );
  });
  test('Groups positive filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'info',
      },
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'error',
      },
    ];

    expect(renderLogQLMetadataFilters(filters)).toEqual('| level="info" or level="error"');
  });
  test('Renders grouped and ungrouped positive and negative filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'info',
      },
      {
        key: 'component',
        operator: FilterOp.NotEqual,
        value: 'comp1',
      },
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'error',
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: 'lil-cluster',
      },
      {
        key: 'pod',
        operator: FilterOp.NotEqual,
        value: 'pod1',
      },
    ];

    expect(renderLogQLMetadataFilters(filters)).toEqual(
      '| level="info" or level="error" | cluster="lil-cluster" | component!="comp1" | pod!="pod1"'
    );
  });
  test('Renders positive regex filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.RegexEqual,
        value: 'info',
      },
      {
        key: 'cluster',
        operator: FilterOp.RegexEqual,
        value: 'lil-cluster',
      },
    ];

    expect(renderLogQLMetadataFilters(filters)).toEqual('| level=~"info" | cluster=~"lil-cluster"');
  });
  test('Renders negative regex filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.RegexNotEqual,
        value: 'info',
      },
      {
        key: 'cluster',
        operator: FilterOp.RegexNotEqual,
        value: 'lil-cluster',
      },
    ];

    expect(renderLogQLMetadataFilters(filters)).toEqual('| level!~"info" | cluster!~"lil-cluster"');
  });
  test('Groups positive regex filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.RegexEqual,
        value: 'info',
      },
      {
        key: 'level',
        operator: FilterOp.RegexEqual,
        value: 'error',
      },
    ];

    expect(renderLogQLMetadataFilters(filters)).toEqual('| level=~"info" or level=~"error"');
  });
  test('Escapes regex filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'host',
        operator: FilterOp.RegexEqual,
        value: addAdHocFilterUserInputPrefix(`((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`),
      },
      {
        key: 'level',
        operator: FilterOp.RegexEqual,
        value: 'error',
      },
    ];

    expect(renderLogQLMetadataFilters(filters)).toEqual(
      '| host=~"((25[0-5]|(2[0-4]|1\\\\d|[1-9]|)\\\\d)\\\\.?\\\\b){4}" | level=~"error"'
    );
  });
  test('Renders grouped and ungrouped positive and negative regex filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.RegexEqual,
        value: 'info',
      },
      {
        key: 'component',
        operator: FilterOp.RegexNotEqual,
        value: 'comp1',
      },
      {
        key: 'level',
        operator: FilterOp.RegexEqual,
        value: 'error',
      },
      {
        key: 'cluster',
        operator: FilterOp.RegexEqual,
        value: 'lil-cluster',
      },
      {
        key: 'pod',
        operator: FilterOp.RegexNotEqual,
        value: 'pod1',
      },
    ];

    expect(renderLogQLMetadataFilters(filters)).toEqual(
      '| level=~"info" or level=~"error" | cluster=~"lil-cluster" | component!~"comp1" | pod!~"pod1"'
    );
  });
  test('Renders grouped and ungrouped positive and negative regex and non-regex filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.RegexEqual,
        value: 'info',
      },
      {
        key: 'component',
        operator: FilterOp.RegexNotEqual,
        value: 'comp1',
      },
      {
        key: 'level',
        operator: FilterOp.RegexEqual,
        value: 'error',
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: 'lil-cluster',
      },
      {
        key: 'pod',
        operator: FilterOp.NotEqual,
        value: 'pod1',
      },
    ];

    expect(renderLogQLMetadataFilters(filters)).toEqual(
      '| cluster="lil-cluster" | pod!="pod1" | level=~"info" or level=~"error" | component!~"comp1"'
    );
  });
});
