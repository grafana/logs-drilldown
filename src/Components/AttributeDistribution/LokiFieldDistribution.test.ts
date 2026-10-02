import { buildDistributionQuery } from './LokiFieldDistribution';

describe('buildDistributionQuery', () => {
  it('counts log entries per attribute value by default', () => {
    expect(buildDistributionQuery('{app_id="42"} | logfmt', 'browser_name')).toBe(
      'sum by (browser_name) (count_over_time({app_id="42"} | logfmt | keep browser_name [$__range]))'
    );
  });

  it('counts distinct sessions per attribute value when configured', () => {
    expect(buildDistributionQuery('{app_id="42"} | logfmt', 'browser_name', 'session_id')).toBe(
      'count by (browser_name) (count by (browser_name, session_id) (count_over_time({app_id="42"} | logfmt | keep browser_name, session_id [$__range])))'
    );
  });
});
