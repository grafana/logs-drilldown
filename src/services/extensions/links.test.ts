import { dateTime } from '@grafana/data';
import { LokiQuery } from '../lokiQuery';
import { LinkConfigs, linkConfigs } from './links';

function getTestConfig(links: LinkConfigs, target: Partial<LokiQuery> & { refId: string }) {
  return links?.[0].configure?.({
    timeRange: {
      from: dateTime('2023-02-08T04:00:00.000Z'),
      to: dateTime('2023-02-08T11:00:00.000Z'),
    },
    pluginId: 'grafana-lokiexplore-app',
    timeZone: 'browser',
    id: 0,
    title: 'test',
    dashboard: {
      tags: [],
      title: 'test',
      uid: 'test',
    },
    targets: [target],
  });
}

function getTestTarget(lokiQuery?: Partial<LokiQuery>): Partial<LokiQuery> & { refId: string } {
  return {
    expr: '{cluster="eu-west-1"} |= "\\\\n" ',
    datasource: {
      type: 'loki',
      uid: '123abc',
    },
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
      path: '/a/grafana-lokiexplore-app/explore/service/cloud-gcp/logs?var-ds=123abc&from=1675828800000&to=1675854000000&var-filters=service_name%7C%3D%7Ccloud%2Fgcp&var-filters=resource_type%7C%21%3D%7Cgce_firewall_rule',
    });
  });
  it('should parse case sensitive regex line-filters in double quotes and backticks', () => {
    const target = getTestTarget({
      expr: '{cluster="eu-west-1", resource_type!=`gce_firewall_rule`} |~ "((25[0-5]|(2[0-4]|1\\\\d|[1-9]|)\\\\d)\\\\.?\\\\b){4}" != ` ((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`| json | logfmt | drop __error__, __error_details__',
    });
    const config = getTestConfig(linkConfigs, target);

    const expectedLabelFiltersUrlString =
      '&var-filters=cluster%7C%3D%7Ceu-west-1' + '&var-filters=resource_type%7C%21%3D%7Cgce_firewall_rule';
    const expectedLineFiltersUrlString =
      '&var-lineFilters=caseSensitive%2C0%7C__gfp__%7E%7C%28%2825%5B0-5%5D__gfp__%282%5B0-4%5D__gfp__1%5Cd__gfp__%5B1-9%5D__gfp__%29%5Cd%29%5C.%3F%5Cb%29%7B4%7D' +
      '&var-lineFilters=caseSensitive%2C1%7C%21%3D%7C+%28%2825%5B0-5%5D__gfp__%282%5B0-4%5D__gfp__1%5Cd__gfp__%5B1-9%5D__gfp__%29%5Cd%29%5C.%3F%5Cb%29%7B4%7D';

    expect(config).toEqual({
      path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}`,
    });
  });
  it('should parse case sensitive non-regex line-filters in double quotes and backticks', () => {
    const target = getTestTarget({
      expr: '{cluster="eu-west-1", resource_type!=`gce_firewall_rule`} |= " (?i)caller,__gfp__" |= ` (?i)caller,__gfc__` | json | logfmt | drop __error__, __error_details__',
    });
    const config = getTestConfig(linkConfigs, target);

    const expectedLabelFiltersUrlString =
      '&var-filters=cluster%7C%3D%7Ceu-west-1' + '&var-filters=resource_type%7C%21%3D%7Cgce_firewall_rule';
    const expectedLineFiltersUrlString =
      '&var-lineFilters=caseSensitive%2C0%7C__gfp__%3D%7C+%28%3Fi%29caller__gfc__' +
      // Note: This is a bug! If searching for log lines containing `__gfp__` or `__gfc__`, it will be interpolated as a pipe or a comma in the evaluated string
      '__gfp__' +
      '&var-lineFilters=caseSensitive%2C1%7C__gfp__%3D%7C+%28%3Fi%29caller__gfc__' +
      '__gfc__';

    expect(config).toEqual({
      path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}`,
    });
  });
  it('should parse case insensitive regex line-filters in double quotes and backticks', () => {
    const target = getTestTarget({
      expr: '{cluster="eu-west-1", resource_type!=`gce_firewall_rule`} |~ "(?i)((25[0-5]|(2[0-4]|1\\\\d|[1-9]|)\\\\d)\\\\.?\\\\b){4}" !~ `(?i) ((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`| json | logfmt | drop __error__, __error_details__',
    });
    const config = getTestConfig(linkConfigs, target);

    // &var-filters=cluster|=|eu-west-1
    const expectedLabelFiltersUrlString =
      '&var-filters=cluster%7C%3D%7Ceu-west-1' +
      // &var-filters=resource_type|!=|gce_firewall_rule
      '&var-filters=resource_type%7C%21%3D%7Cgce_firewall_rule';

    // &var-lineFilters=caseInsensitive|__gfp__~|((25[0-5]__gfp__(2[0-4]__gfp__1\d__gfp__[1-9]__gfp__)\d)\.?\b){4}
    const expectedLineFiltersUrlString =
      '&var-lineFilters=caseInsensitive%7C__gfp__%7E%7C%28%2825%5B0-5%5D__gfp__%282%5B0-4%5D__gfp__1%5Cd__gfp__%5B1-9%5D__gfp__%29%5Cd%29%5C.%3F%5Cb%29%7B4%7D' +
      // &var-lineFilters=caseInsensitive|!~|+((25[0-5]__gfp__(2[0-4]__gfp__1\d__gfp__[1-9]__gfp__)\d)\.?\b){4}
      '&var-lineFilters=caseInsensitive%7C%21%7E%7C+%28%2825%5B0-5%5D__gfp__%282%5B0-4%5D__gfp__1%5Cd__gfp__%5B1-9%5D__gfp__%29%5Cd%29%5C.%3F%5Cb%29%7B4%7D';

    expect(config).toEqual({
      path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}`,
    });
  });
  it('should parse case sensitive non-regex line-filters in double quotes and backticks containing case insensitive string, newlines, and double quotes', () => {
    const target = getTestTarget({
      expr: '{cluster="eu-west-1", resource_type!=`gce_firewall_rule`} |= `" (?i)caller"` |=  " (?i)caller.+\\\\\\\\n" | json | logfmt | drop __error__, __error_details__',
    });
    const config = getTestConfig(linkConfigs, target);

    // &var-filters=cluster|=|eu-west-1
    const expectedLabelFiltersUrlString =
      '&var-filters=cluster%7C%3D%7Ceu-west-1' +
      // &var-filters=resource_type|!=|gce_firewall_rule
      '&var-filters=resource_type%7C%21%3D%7Cgce_firewall_rule';

    // &var-lineFilters=caseSensitive,0|__gfp__=|"+(?i)caller"
    const expectedLineFiltersUrlString =
      '&var-lineFilters=caseSensitive%2C0%7C__gfp__%3D%7C%22+%28%3Fi%29caller%22' +
      // &var-lineFilters=caseSensitive,1|__gfp__=|+(?i)caller.+\\\\n
      '&var-lineFilters=caseSensitive%2C1%7C__gfp__%3D%7C+%28%3Fi%29caller.%2B%5C%5Cn';

    expect(config).toEqual({
      path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}`,
    });
  });
  it('should parse case sensitive non-regex line-filter containing double quotes', () => {
    const target = getTestTarget({ expr: '{cluster="eu-west-1"} |= "thread \\\\\\"main\\\\\\""' });
    const config = getTestConfig(linkConfigs, target);

    const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

    // &var-lineFilters=caseSensitive,0|__gfp__=|thread \"main\"
    const expectedLineFiltersUrlString = '&var-lineFilters=caseSensitive%2C0%7C__gfp__%3D%7Cthread+%5C%22main%5C%22';

    expect(config).toEqual({
      path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}`,
    });
  });
  it('should parse case sensitive non-regex line-filter containing newline match', () => {
    const target = getTestTarget({ expr: `{cluster="eu-west-1"} |= "\\\\n"` });
    const config = getTestConfig(linkConfigs, target);

    const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

    // &var-lineFilters=caseSensitive,0|__gfp__=|\n
    const expectedLineFiltersUrlString = '&var-lineFilters=caseSensitive%2C0%7C__gfp__%3D%7C%5Cn';

    expect(config).toEqual({
      path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}`,
    });
  });
  it('should return undefined when no non-regex include filters are present', () => {
    const target = getTestTarget({
      expr: `sort_desc(sum by (error) (count_over_time({service_name=~"grafana/.*", cluster=~"prod-eu-west-2"} | logfmt | level="error" | logger=~".*grafana-datasource.*|.*coreplugin" | statusSource!="downstream" | error!="" |~"Partial data response error|Plugin Request Completed" | endpoint="queryData" [$__auto])))`,
    });
    const config = getTestConfig(linkConfigs, target);
    expect(config).toEqual(undefined);
  });
  it('should not confuse field filters with indexed label filters', () => {
    const target = getTestTarget({
      expr: `sort_desc(sum by (error) (count_over_time({service_name=~"grafana/.*", cluster="eu-west-1"} | logfmt | level="error" | logger=~".*grafana-datasource.*|.*coreplugin" | statusSource!="downstream" | error!="" |~"Partial data response error|Plugin Request Completed" | endpoint="queryData" [$__auto])))`,
    });
    const config = getTestConfig(linkConfigs, target);

    const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

    // var-lineFilters=caseSensitive,0|__gfp__~|Partial data response error__gfp__Plugin Request Completed
    const expectedLineFiltersUrlString =
      '&var-lineFilters=caseSensitive%2C0%7C__gfp__%7E%7CPartial+data+response+error__gfp__Plugin+Request+Completed';

    expect(config).toEqual({
      path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}`,
    });
  });
});
