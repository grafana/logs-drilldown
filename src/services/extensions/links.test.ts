import { dateTime, PluginExtensionPanelContext, CustomVariableModel, VariableHide, LoadingState } from '@grafana/data';

import {
  ValidByteUnitValues,
  validDurationValues,
} from '../../Components/ServiceScene/Breakdowns/NumericFilterPopoverScene';
import { LokiQuery } from '../lokiQuery';
import { addAdHocFilterUserInputPrefix, EMPTY_VARIABLE_VALUE } from '../variables';
import { interpolateQueryExpr, LinkConfigs, linkConfigs } from './links';
import { addCustomInputPrefixAndValueLabels, encodeFilter, getPath } from './utils';

// Mocking templateSrv is such a pain, if you are fighting variable interpolation start here.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: jest.fn(() => ({
    replace: jest.fn((a: string, ...rest: unknown[]) => {
      if (a === '${ds}') {
        return '123abc';
      }
      if (a.includes('$adhoc')) {
        return a.replace('$adhoc', 'cluster="eu-west-1"');
      }
      return a;
    }),
  })),
}));

function getTestConfig(
  links: LinkConfigs,
  target: Partial<LokiQuery> & { refId: string },
  context?: Partial<PluginExtensionPanelContext>
) {
  return links?.[0].configure?.({
    dashboard: {
      tags: [],
      title: 'test',
      uid: '${ds}',
    },
    scopedVars: { ds: { value: 'test', text: 'test' } },
    id: 0,
    pluginId: 'grafana-lokiexplore-app',
    timeRange: {
      from: dateTime('2023-02-08T04:00:00.000Z'),
      to: dateTime('2023-02-08T11:00:00.000Z'),
    },
    timeZone: 'browser',
    title: 'test',
    ...context,
    targets: [target],
  });
}

function getTestTarget(lokiQuery?: Partial<LokiQuery>): Partial<LokiQuery> & { refId: string } {
  return {
    datasource: {
      type: 'loki',
      uid: '${ds}',
    },
    expr: '{$adhoc} |= "\\\\n" ',
    ...lokiQuery,
    refId: lokiQuery?.refId ?? 'A', // Ensure refId is defined
  };
}

describe('contextToLink', () => {
  it('should strip slashes', () => {
    const target = getTestTarget({
      expr: '{service_name=`cloud/gcp`, resource_type!=`gce_firewall_rule`} | json | logfmt | drop __error__, __error_details__',
    });
    const config = getTestConfig(linkConfigs, target);

    expect(config).toEqual({
      path: getPath({
        expectedLabelFiltersUrlString:
          `&var-filters=${encodeFilter(`service_name|=|${addCustomInputPrefixAndValueLabels('cloud/gcp')}`)}` +
          `&var-filters=${encodeFilter(`resource_type|!=|${addCustomInputPrefixAndValueLabels('gce_firewall_rule')}`)}`,
        slug: 'service/cloud-gcp',
      }),
    });
  });

  describe('var-levels', () => {
    it('should parse detected_level', () => {
      const target = getTestTarget({
        expr: '{service_name=~`nginx.+`, env=`staging`} | detected_level != "" | detected_level!="" | detected_level=`warn` | detected_level=~`warn|info` ',
      });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString =
        `&var-filters=${encodeFilter(`service_name|=~|${addCustomInputPrefixAndValueLabels('nginx.+')}`)}` +
        `&var-filters=${encodeFilter(`env|=|${addCustomInputPrefixAndValueLabels('staging')}`)}`;

      const expectedLevelsFilterUrlString =
        `&var-levels=${encodeFilter('detected_level|!=|""')}` +
        `&var-levels=${encodeFilter('detected_level|!=|""')}` +
        `&var-levels=${encodeFilter(`detected_level|=|warn`)}` +
        `&var-levels=${encodeFilter(`detected_level|=~|warn__gfp__info`)}`;
      expect(config).toEqual({
        path: getPath({
          expectedLabelFiltersUrlString,
          expectedLevelsFilterUrlString,
          slug: 'service/nginx.+',
        }),
      });
    });
  });

  describe('line-filters', () => {
    it('should parse case sensitive regex line-filters in double quotes and backticks', () => {
      const target = getTestTarget({
        expr: '{$adhoc, resource_type!=`gce_firewall_rule`} |~ "((25[0-5]|(2[0-4]|1\\\\d|[1-9]|)\\\\d)\\\\.?\\\\b){4}" != ` ((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`| json | logfmt | drop __error__, __error_details__',
      });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString =
        `&var-filters=${encodeFilter(`cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`)}` +
        `&var-filters=${encodeFilter(`resource_type|!=|${addCustomInputPrefixAndValueLabels('gce_firewall_rule')}`)}`;
      const expectedLineFiltersUrlString =
        `&var-lineFilters=${encodeFilter(
          'caseSensitive,0|__gfp__~|((25[0-5]__gfp__(2[0-4]__gfp__1\\d__gfp__[1-9]__gfp__)\\d)\\.?\\b){4}'
        )}` +
        `&var-lineFilters=${encodeFilter(
          'caseSensitive,1|!=| ((25[0-5]__gfp__(2[0-4]__gfp__1\\d__gfp__[1-9]__gfp__)\\d)\\.?\\b){4}'
        )}`;

      expect(config).toEqual({
        path: getPath({
          expectedLabelFiltersUrlString,
          expectedLineFiltersUrlString,
          slug: 'cluster/eu-west-1',
        }),
      });
    });
    it('should parse case sensitive non-regex line-filters in double quotes and backticks', () => {
      const target = getTestTarget({
        expr: '{cluster="eu-west-1", resource_type!=`gce_firewall_rule`} |= " (?i)caller,__gfp__" |= ` (?i)caller,__gfc__` | json | logfmt | drop __error__, __error_details__',
      });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString =
        `&var-filters=${encodeFilter(`cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`)}` +
        `&var-filters=${encodeFilter(`resource_type|!=|${addCustomInputPrefixAndValueLabels('gce_firewall_rule')}`)}`;
      const expectedLineFiltersUrlString =
        `&var-lineFilters=${encodeFilter('caseSensitive,0|__gfp__=| (?i)caller__gfc__')}` +
        // Note: This is a bug! If searching for log lines containing `__gfp__` or `__gfc__`, it will be interpolated as a pipe or a comma in the evaluated string
        '__gfp__' +
        `&var-lineFilters=${encodeFilter('caseSensitive,1|__gfp__=| (?i)caller__gfc__')}` +
        '__gfc__';

      expect(config).toEqual({
        path: getPath({
          expectedLabelFiltersUrlString,
          expectedLineFiltersUrlString,
          slug: 'cluster/eu-west-1',
        }),
      });
    });

    it('should parse non-regex line-filters containing `\\""`', () => {
      const target = getTestTarget({
        //  "\\\\\\"\\"" or `\""`
        expr: '{cluster="eu-west-1"} |= `\\""` | json | logfmt | drop __error__, __error_details__',
      });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
        `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
      )}`;
      const expectedLineFiltersUrlString = `&var-lineFilters=${encodeFilter(`caseSensitive,0|__gfp__=|\\""`)}`;

      expect(config).toEqual({
        path: getPath({
          expectedLabelFiltersUrlString,
          expectedLineFiltersUrlString,
          slug: 'cluster/eu-west-1',
        }),
      });
    });
    it('should parse case insensitive regex line-filters in double quotes and backticks', () => {
      const target = getTestTarget({
        expr: '{cluster="eu-west-1", resource_type!=`gce_firewall_rule`} |~ "(?i)((25[0-5]|(2[0-4]|1\\\\d|[1-9]|)\\\\d)\\\\.?\\\\b){4}" !~ `(?i) ((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`| json | logfmt | drop __error__, __error_details__',
      });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString =
        `&var-filters=${encodeFilter(`cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`)}` +
        `&var-filters=${encodeFilter(`resource_type|!=|${addCustomInputPrefixAndValueLabels('gce_firewall_rule')}`)}`;

      const expectedLineFiltersUrlString =
        `&var-lineFilters=${encodeFilter(
          'caseInsensitive|__gfp__~|((25[0-5]__gfp__(2[0-4]__gfp__1\\d__gfp__[1-9]__gfp__)\\d)\\.?\\b){4}'
        )}` +
        `&var-lineFilters=${encodeFilter(
          'caseInsensitive|!~| ((25[0-5]__gfp__(2[0-4]__gfp__1\\d__gfp__[1-9]__gfp__)\\d)\\.?\\b){4}'
        )}`;

      expect(config).toEqual({
        path: getPath({
          expectedLabelFiltersUrlString,
          expectedLineFiltersUrlString,
          slug: 'cluster/eu-west-1',
        }),
      });
    });
    it('should parse case sensitive non-regex line-filters in double quotes and backticks containing case insensitive string, newlines, and double quotes', () => {
      const target = getTestTarget({
        expr: '{cluster="eu-west-1", resource_type!=`gce_firewall_rule`} |= `" (?i)caller"` |=  " (?i)caller.+\\\\\\\\n" | json | logfmt | drop __error__, __error_details__',
      });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString =
        `&var-filters=${encodeFilter(`cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`)}` +
        `&var-filters=${encodeFilter(`resource_type|!=|${addCustomInputPrefixAndValueLabels('gce_firewall_rule')}`)}`;

      const expectedLineFiltersUrlString =
        `&var-lineFilters=${encodeFilter('caseSensitive,0|__gfp__=|" (?i)caller"')}` +
        `&var-lineFilters=${encodeFilter('caseSensitive,1|__gfp__=| (?i)caller.+\\\\n')}`;

      expect(config).toEqual({
        path: getPath({
          expectedLabelFiltersUrlString,
          expectedLineFiltersUrlString,
          slug: 'cluster/eu-west-1',
        }),
      });
    });
    it('should parse case sensitive non-regex line-filter containing double quotes', () => {
      const target = getTestTarget({ expr: '{cluster="eu-west-1"} |= "thread \\\\\\"main\\\\\\""' });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
        `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
      )}`;
      const expectedLineFiltersUrlString = `&var-lineFilters=${encodeFilter(
        'caseSensitive,0|__gfp__=|thread \\"main\\"'
      )}`;

      expect(config).toEqual({
        path: getPath({
          expectedLabelFiltersUrlString,
          expectedLineFiltersUrlString,
          slug: 'cluster/eu-west-1',
        }),
      });
    });
    it('should parse case sensitive non-regex line-filter containing newline match', () => {
      const target = getTestTarget({ expr: `{cluster="eu-west-1"} |= "\\\\n"` });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
        `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
      )}`;
      const expectedLineFiltersUrlString = `&var-lineFilters=${encodeFilter('caseSensitive,0|__gfp__=|\\n')}`;

      expect(config).toEqual({
        path: getPath({
          expectedLabelFiltersUrlString,
          expectedLineFiltersUrlString,
          slug: 'cluster/eu-west-1',
        }),
      });
    });
    it('should parse regex labels, fields, and line filters', () => {
      const target = getTestTarget({
        expr: `sort_desc(sum by (error) (count_over_time({service_name=~"grafana/.*", cluster=~"prod-eu-west-2"} | logfmt | level="error" | logger=~".*grafana-datasource.*|.*coreplugin" | statusSource!="downstream" | error!="" |~"Partial data response error|Plugin Request Completed" | endpoint="queryData" [$__auto])))`,
      });
      const config = getTestConfig(linkConfigs, target);
      const expectedLabelFiltersUrlString =
        `&var-filters=${encodeFilter(`service_name|=~|${addCustomInputPrefixAndValueLabels('grafana/.*')}`)}` +
        `&var-filters=${encodeFilter(`cluster|=~|${addCustomInputPrefixAndValueLabels('prod-eu-west-2')}`)}`;

      const expectedLineFiltersUrlString = `&var-lineFilters=${encodeFilter(
        'caseSensitive,0|__gfp__~|Partial data response error__gfp__Plugin Request Completed'
      )}`;

      const expectedFieldsUrlString =
        `&var-fields=${encodeFilter(
          `level|=|${addAdHocFilterUserInputPrefix('{"value":"error"__gfc__"parser":"logfmt"}')},error`
        )}` +
        `&var-fields=${encodeFilter(
          `logger|=~|${addAdHocFilterUserInputPrefix(
            '{"value":".*grafana-datasource.*__gfp__.*coreplugin"__gfc__"parser":"logfmt"}'
          )},.*grafana-datasource.*__gfp__.*coreplugin`
        )}` +
        `&var-fields=${encodeFilter(
          `statusSource|!=|${addAdHocFilterUserInputPrefix(
            '{"value":"downstream"__gfc__"parser":"logfmt"}'
          )},downstream`
        )}` +
        `&var-fields=${encodeFilter(
          `error|!=|${addAdHocFilterUserInputPrefix(
            `{"value":${EMPTY_VARIABLE_VALUE}__gfc__"parser":"logfmt"}`
          )},${EMPTY_VARIABLE_VALUE}`
        )}` +
        `&var-fields=${encodeFilter(
          `endpoint|=|${addAdHocFilterUserInputPrefix('{"value":"queryData"__gfc__"parser":"logfmt"}')},queryData`
        )}`;

      expect(config).toEqual({
        path: getPath({
          expectedFieldsUrlString,
          expectedLabelFiltersUrlString,
          expectedLineFiltersUrlString,
          slug: 'service/grafana-.*',
        }),
      });
    });
    it('should not confuse field filters with indexed label filters', () => {
      const target = getTestTarget({
        expr: `sort_desc(sum by (error) (count_over_time({cluster="eu-west-1", service_name=~"grafana/.*"} | logfmt | level="error" | logger=~".*grafana-datasource.*|.*coreplugin" | statusSource!="downstream" | error!="" |~"Partial data response error|Plugin Request Completed" | endpoint="queryData" [$__auto])))`,
      });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString =
        `&var-filters=${encodeFilter(`cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`)}` +
        `&var-filters=${encodeFilter(`service_name|=~|${addCustomInputPrefixAndValueLabels('grafana/.*')}`)}`;

      const expectedLineFiltersUrlString = `&var-lineFilters=${encodeFilter(
        'caseSensitive,0|__gfp__~|Partial data response error__gfp__Plugin Request Completed'
      )}`;

      const expectedFieldsUrlString =
        `&var-fields=${encodeFilter(
          `level|=|${addAdHocFilterUserInputPrefix('{"value":"error"__gfc__"parser":"logfmt"}')},error`
        )}` +
        `&var-fields=${encodeFilter(
          `logger|=~|${addAdHocFilterUserInputPrefix(
            '{"value":".*grafana-datasource.*__gfp__.*coreplugin"__gfc__"parser":"logfmt"}'
          )},.*grafana-datasource.*__gfp__.*coreplugin`
        )}` +
        `&var-fields=${encodeFilter(
          `statusSource|!=|${addAdHocFilterUserInputPrefix(
            '{"value":"downstream"__gfc__"parser":"logfmt"}'
          )},downstream`
        )}` +
        `&var-fields=${encodeFilter(
          `error|!=|${addAdHocFilterUserInputPrefix(
            `{"value":${EMPTY_VARIABLE_VALUE}__gfc__"parser":"logfmt"}`
          )},${EMPTY_VARIABLE_VALUE}`
        )}` +
        `&var-fields=${encodeFilter(
          `endpoint|=|${addAdHocFilterUserInputPrefix('{"value":"queryData"__gfc__"parser":"logfmt"}')},queryData`
        )}`;

      expect(config).toEqual({
        path: getPath({
          expectedFieldsUrlString,
          expectedLabelFiltersUrlString,
          expectedLineFiltersUrlString,
          slug: 'cluster/eu-west-1',
        }),
      });
    });
  });

  describe('pattern-filters', () => {
    it('should parse pattern filters', () => {
      const target = getTestTarget({
        expr: '{cluster="eu-west-1"} !> "<_> - - [<_> +0000]" |> "<_> - <_> [<_> +0000]" | json | logfmt | drop __error__, __error_details__',
      });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
        `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
      )}`;

      const expectedPatternsVariable = `&var-patterns=${encodeFilter(
        '!> "<_> - - [<_> +0000]" |> "<_> - <_> [<_> +0000]"'
      )}`;

      const pattern = `[{"type":"exclude","pattern":"<_> - - [<_> +0000]"},{"type":"include","pattern":"<_> - <_> [<_> +0000]"}]`;
      const expectedPatterns = `&patterns=${encodeFilter(pattern)}`;

      expect(config).toEqual({
        path: getPath({
          expectedLabelFiltersUrlString,
          expectedPatterns,
          expectedPatternsVariable,
          slug: 'cluster/eu-west-1',
        }),
      });
    });
    it('should parse multiple pattern filters', () => {
      const target = getTestTarget({
        expr: '{cluster="eu-west-1"} !> "<_> - - [<_> +0000]" |> "<_> - <_> [<_> +0000]" or "<_> - <_> [<_> +0000] \\"POST <_> <_>\\"" | json | logfmt | drop __error__, __error_details__',
      });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
        `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
      )}`;

      const expectedPatternsVariable = `&var-patterns=${encodeFilter(
        '!> "<_> - - [<_> +0000]" |> "<_> - <_> [<_> +0000]" or "<_> - <_> [<_> +0000] \\"POST <_> <_>\\""'
      )}`;

      const pattern = `[{"type":"exclude","pattern":"<_> - - [<_> +0000]"},{"type":"include","pattern":"<_> - <_> [<_> +0000]"},{"type":"include","pattern":"<_> - <_> [<_> +0000] \\"POST <_> <_>\\""}]`;
      const expectedPatterns = `&patterns=${encodeFilter(pattern)}`;

      expect(config).toEqual({
        path: getPath({
          expectedLabelFiltersUrlString,
          expectedPatterns,
          expectedPatternsVariable,
          slug: 'cluster/eu-west-1',
        }),
      });
    });
    it('should parse empty filters', () => {
      const target = getTestTarget({
        expr: '{cluster="eu-west-1"} !> "" !> "" |> "" or "" | json | logfmt | drop __error__, __error_details__',
      });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
        `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
      )}`;

      expect(config).toEqual({
        path: getPath({
          expectedLabelFiltersUrlString,
          slug: 'cluster/eu-west-1',
        }),
      });
    });
  });

  describe('fields', () => {
    describe('string fields', () => {
      it('should parse structured metadata field', () => {
        const target = getTestTarget({ expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` ` });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;
        const expectedLineFiltersUrlString = `&var-metadata=${encodeFilter(
          `pod|!=|${addCustomInputPrefixAndValueLabels('mimir-ingester-xjntw')}`
        )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });
      it('should add label for empty variable value', () => {
        const target = getTestTarget({
          expr: `{cluster="C:\\Grafana\\logs\\log.txt"} | pod!=\`mimir-ingester-xjntw\` | logfmt | msg=${EMPTY_VARIABLE_VALUE}`,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('C:\\Grafana\\logs\\log.txt')}`
        )}`;
        const expectedMetadataString = `&var-metadata=${encodeFilter(
          `pod|!=|${addCustomInputPrefixAndValueLabels('mimir-ingester-xjntw')}`
        )}`;
        const expectedFieldsUrlString = `&var-fields=${encodeFilter(
          `msg|=|${addAdHocFilterUserInputPrefix(
            `{"value":${EMPTY_VARIABLE_VALUE}__gfc__"parser":"logfmt"}`
          )},${EMPTY_VARIABLE_VALUE}`
        )}`;

        expect(config).toEqual({
          path: getPath({
            expectedFieldsUrlString,
            expectedLabelFiltersUrlString,
            expectedMetadataString,
            slug: 'cluster/C:-Grafana-logs-log.txt',
          }),
        });
      });
      it('should parse label with escape chars, escape chars should get replaced in url', () => {
        const target = getTestTarget({
          expr: `{cluster="C:\\Grafana\\logs\\log.txt"} | pod!=\`mimir-ingester-xjntw\` `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('C:\\Grafana\\logs\\log.txt')}`
        )}`;
        const expectedLineFiltersUrlString = `&var-metadata=${encodeFilter(
          `pod|!=|${addCustomInputPrefixAndValueLabels('mimir-ingester-xjntw')}`
        )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            slug: 'cluster/C:-Grafana-logs-log.txt',
          }),
        });
      });
      it('should parse structured metadata field with parser(s)', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | json `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;
        const expectedLineFiltersUrlString = `&var-metadata=${encodeFilter(
          `pod|!=|${addCustomInputPrefixAndValueLabels('mimir-ingester-xjntw')}`
        )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });
      it('should parse field with logfmt parser', () => {
        const target = getTestTarget({ expr: `{cluster="eu-west-1"} | logfmt | pod=\`mimir-ingester-xjntw\`` });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;
        const expectedFieldsUrlString = `&var-fields=${encodeFilter(
          `pod|=|${addAdHocFilterUserInputPrefix(
            '{"value":"mimir-ingester-xjntw"__gfc__"parser":"logfmt"}'
          )},mimir-ingester-xjntw`
        )}`;

        expect(config).toEqual({
          path: getPath({
            expectedFieldsUrlString,
            expectedLabelFiltersUrlString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });
      it('should parse field with json parser', () => {
        const target = getTestTarget({ expr: `{cluster="eu-west-1"} | json | pod=\`mimir-ingester-xjntw\`  ` });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;
        const expectedLineFiltersUrlString = `&var-fields=${encodeFilter(
          `pod|=|${addAdHocFilterUserInputPrefix(
            '{"value":"mimir-ingester-xjntw"__gfc__"parser":"json"}'
          )},mimir-ingester-xjntw`
        )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });
      it('should parse field with mixed parser', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | logfmt | json | pod=\`mimir-ingester-xjntw\`  `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;
        const expectedLineFiltersUrlString = `&var-fields=${encodeFilter(
          `pod|=|${addAdHocFilterUserInputPrefix(
            '{"value":"mimir-ingester-xjntw"__gfc__"parser":"mixed"}'
          )},mimir-ingester-xjntw`
        )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });
      it('should ignore __error__ filters', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | logfmt | json | drop __error__, __error_details__ | pod=\`mimir-ingester-xjntw\` | __error__=""  `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;

        const expectedLineFiltersUrlString = `&var-fields=${encodeFilter(
          `pod|=|${addAdHocFilterUserInputPrefix(
            '{"value":"mimir-ingester-xjntw"__gfc__"parser":"mixed"}'
          )},mimir-ingester-xjntw`
        )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });
      it('should ignore metric queries', () => {
        const target = getTestTarget({
          expr: `sum(count_over_time({cluster=\`eu-west-1\`} | logfmt | json | pod=\`mimir-ingester-xjntw\` [$__auto])) by (detected_level)`,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;
        const expectedLineFiltersUrlString = `&var-fields=${encodeFilter(
          `pod|=|${addAdHocFilterUserInputPrefix(
            '{"value":"mimir-ingester-xjntw"__gfc__"parser":"mixed"}'
          )},mimir-ingester-xjntw`
        )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });
      it('should ignore unwrap', () => {
        const target = getTestTarget({
          expr: `avg_over_time({cluster=\`eu-west-1\`} | logfmt | pod=\`mimir-ingester-xjntw\` | unwrap duration(duration) | __error__="" [$__auto]) by ()`,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;
        const expectedLineFiltersUrlString = `&var-fields=${encodeFilter(
          `pod|=|${addAdHocFilterUserInputPrefix(
            '{"value":"mimir-ingester-xjntw"__gfc__"parser":"logfmt"}'
          )},mimir-ingester-xjntw`
        )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });
      it('should parse regex match', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | logfmt | json | pod=\`mimir-ingester-xjntw\` | pod=~\`mimir-ingester-.+\``,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;
        const expectedLineFiltersUrlString =
          `&var-fields=${encodeFilter(
            `pod|=|${addAdHocFilterUserInputPrefix(
              '{"value":"mimir-ingester-xjntw"__gfc__"parser":"mixed"}'
            )},mimir-ingester-xjntw`
          )}` +
          `&var-fields=${encodeFilter(
            `pod|=~|${addAdHocFilterUserInputPrefix(
              '{"value":"mimir-ingester-.+"__gfc__"parser":"mixed"}'
            )},mimir-ingester-.+`
          )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });
      it('should parse regex exclusion', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | logfmt | json | pod=\`mimir-ingester-xjntw\` | pod!~\`mimir-ingester-.+\``,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;
        const expectedLineFiltersUrlString =
          `&var-fields=${encodeFilter(
            `pod|=|${addAdHocFilterUserInputPrefix(
              '{"value":"mimir-ingester-xjntw"__gfc__"parser":"mixed"}'
            )},mimir-ingester-xjntw`
          )}` +
          `&var-fields=${encodeFilter(
            `pod|!~|${addAdHocFilterUserInputPrefix(
              '{"value":"mimir-ingester-.+"__gfc__"parser":"mixed"}'
            )},mimir-ingester-.+`
          )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });
    });

    describe('numeric fields', () => {
      it('should parse gt', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | duration > 10s `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;
        const expectedMetadataString = `&var-metadata=${encodeFilter(
          `pod|!=|${addCustomInputPrefixAndValueLabels('mimir-ingester-xjntw')}`
        )}`;
        const expectedLineFiltersUrlString = `&var-fields=${encodeFilter(
          `duration|>|${addAdHocFilterUserInputPrefix('{"value":"10s"__gfc__"parser":"logfmt"}')},10s`
        )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            expectedMetadataString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });
      it('should parse gte', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | duration >= 10s `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;
        const expectedMetadataString = `&var-metadata=${encodeFilter(
          `pod|!=|${addCustomInputPrefixAndValueLabels('mimir-ingester-xjntw')}`
        )}`;
        const expectedLineFiltersUrlString = `&var-fields=${encodeFilter(
          `duration|>=|${addAdHocFilterUserInputPrefix('{"value":"10s"__gfc__"parser":"logfmt"}')},10s`
        )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            expectedMetadataString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });
      it('should parse lt', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | duration < 10s `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;
        const expectedMetadataString = `&var-metadata=${encodeFilter(
          `pod|!=|${addCustomInputPrefixAndValueLabels('mimir-ingester-xjntw')}`
        )}`;
        const expectedLineFiltersUrlString = `&var-fields=${encodeFilter(
          `duration|<|${addAdHocFilterUserInputPrefix('{"value":"10s"__gfc__"parser":"logfmt"}')},10s`
        )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            expectedMetadataString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });
      it('should parse lte', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | duration <= 10s `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;
        const expectedMetadataString = `&var-metadata=${encodeFilter(
          `pod|!=|${addCustomInputPrefixAndValueLabels('mimir-ingester-xjntw')}`
        )}`;
        const expectedLineFiltersUrlString = `&var-fields=${encodeFilter(
          `duration|<=|${addAdHocFilterUserInputPrefix('{"value":"10s"__gfc__"parser":"logfmt"}')},10s`
        )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            expectedMetadataString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });
      it('should support multiple field inclusion expressions', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | duration <= 10s or duration > 10.2s `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
          `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
        )}`;
        const expectedMetadataString = `&var-metadata=${encodeFilter(
          `pod|!=|${addCustomInputPrefixAndValueLabels('mimir-ingester-xjntw')}`
        )}`;
        const expectedLineFiltersUrlString =
          `&var-fields=${encodeFilter(
            `duration|<=|${addAdHocFilterUserInputPrefix('{"value":"10s"__gfc__"parser":"logfmt"}')},10s`
          )}` +
          `&var-fields=${encodeFilter(
            `duration|>|${addAdHocFilterUserInputPrefix('{"value":"10.2s"__gfc__"parser":"logfmt"}')},10.2s`
          )}`;

        expect(config).toEqual({
          path: getPath({
            expectedLabelFiltersUrlString,
            expectedLineFiltersUrlString,
            expectedMetadataString,
            slug: 'cluster/eu-west-1',
          }),
        });
      });

      describe('duration', () => {
        it.each(Object.values(validDurationValues))('should parse duration with %s unit', (...units) => {
          units.forEach((unit) => {
            const target = getTestTarget({
              expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | duration >= 10.1${unit}`,
            });
            const config = getTestConfig(linkConfigs, target);

            const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
              `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
            )}`;
            const expectedMetadataString = `&var-metadata=${encodeFilter(
              `pod|!=|${addCustomInputPrefixAndValueLabels('mimir-ingester-xjntw')}`
            )}`;
            const expectedLineFiltersUrlString = `&var-fields=${encodeFilter(
              `duration|>=|${addAdHocFilterUserInputPrefix(
                `{"value":"10.1${unit}"__gfc__"parser":"logfmt"}`
              )},10.1${unit}`
            )}`;

            expect(config).toEqual({
              path: getPath({
                expectedLabelFiltersUrlString,
                expectedLineFiltersUrlString,
                expectedMetadataString,
                slug: 'cluster/eu-west-1',
              }),
            });
          });
        });

        const cases = ['1h15m30.918273645s', '1h0.0m0s', '-1s'];
        it.each(cases)('should parse complex duration units: %s', (unit) => {
          const target = getTestTarget({
            expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | duration <= ${unit} `,
          });
          const config = getTestConfig(linkConfigs, target);

          const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
            `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
          )}`;
          const expectedMetadataString = `&var-metadata=${encodeFilter(
            `pod|!=|${addCustomInputPrefixAndValueLabels('mimir-ingester-xjntw')}`
          )}`;
          const expectedLineFiltersUrlString = `&var-fields=${encodeFilter(
            `duration|<=|${addAdHocFilterUserInputPrefix(`{"value":"${unit}"__gfc__"parser":"logfmt"}`)},${unit}`
          )}`;

          expect(config).toEqual({
            path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedMetadataString}${expectedLineFiltersUrlString}`,
          });
        });
      });
      describe('bytes', () => {
        it.each(Object.values(ValidByteUnitValues))('should parse bytes with %s unit', (unit: string) => {
          const target = getTestTarget({
            expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | bytes >= 10.1${unit}`,
          });
          const config = getTestConfig(linkConfigs, target);
          const expectedLabelFiltersUrlString = `&var-filters=${encodeFilter(
            `cluster|=|${addCustomInputPrefixAndValueLabels('eu-west-1')}`
          )}`;
          const expectedMetadataString = `&var-metadata=${encodeFilter(
            `pod|!=|${addCustomInputPrefixAndValueLabels('mimir-ingester-xjntw')}`
          )}`;
          const expectedLineFiltersUrlString = `&var-fields=${encodeFilter(
            `bytes|>=|${addAdHocFilterUserInputPrefix(`{"value":"10.1${unit}"__gfc__"parser":"logfmt"}`)},10.1${unit}`
          )}`;

          expect(config).toEqual({
            path: getPath({
              expectedLabelFiltersUrlString,
              expectedLineFiltersUrlString,
              expectedMetadataString,
              slug: 'cluster/eu-west-1',
            }),
          });
        });
      });
    });
  });
});

describe('interpolateQueryExpr', () => {
  it('interpolates dashboard custom multi variable', () => {
    const variable: CustomVariableModel = {
      current: {
        selected: false,
        text: '',
        value: '',
      },
      multi: true,
      includeAll: false,
      allowCustomValue: true,
      type: 'custom',
      options: [],
      query: '',
      name: '',
      id: '',
      rootStateKey: null,
      global: false,
      skipUrlSync: false,
      index: 0,
      error: undefined,
      description: null,
      hide: VariableHide.dontHide,
      state: LoadingState.Done,
    };
    expect(interpolateQueryExpr(['value1', 'value2'], variable)).toEqual('value1|value2');
  });
});
