import { dateTime } from '@grafana/data';

import { buildFieldLinkFromQuery, buildServiceLinkFromQuery } from './fieldLinks';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: jest.fn(() => ({
    replace: jest.fn((a: string) => a),
  })),
}));

const TIME_RANGE_MS = {
  from: dateTime('2023-02-08T04:00:00.000Z').valueOf(),
  to: dateTime('2023-02-08T11:00:00.000Z').valueOf(),
};

describe('buildServiceLinkFromQuery', () => {
  it('returns undefined when query has no inclusive label selector', () => {
    expect(buildServiceLinkFromQuery('{service_name!="myapp"}', 'ds-uid', TIME_RANGE_MS)).toBeUndefined();
  });

  it('maps service_name to "service" in the URL path', () => {
    const url = buildServiceLinkFromQuery('{service_name="myapp"}', 'ds-uid', TIME_RANGE_MS);
    expect(url).toContain('/explore/service/myapp/logs');
  });

  it('uses label key as-is for non-service_name labels', () => {
    const url = buildServiceLinkFromQuery('{app_id="my-app"}', 'ds-uid', TIME_RANGE_MS);
    expect(url).toContain('/explore/app_id/my-app/logs');
  });

  it('uses first value when label has multiple pipe-delimited values', () => {
    const url = buildServiceLinkFromQuery('{service_name=~"appA|appB"}', 'ds-uid', TIME_RANGE_MS);
    expect(url).toContain('/explore/service/appA/logs');
  });

  it('includes datasource uid and time range in query params', () => {
    const url = buildServiceLinkFromQuery('{service_name="myapp"}', 'ds-uid', TIME_RANGE_MS)!;
    expect(url).toContain('var-ds=ds-uid');
    expect(url).toContain('from=');
    expect(url).toContain('to=');
  });
});

describe('buildFieldLinkFromQuery', () => {
  it('returns undefined when query has no inclusive label selector', () => {
    expect(buildFieldLinkFromQuery('{service_name!="myapp"}', 'ds-uid', TIME_RANGE_MS, 'status')).toBeUndefined();
  });

  it('builds path with field name under /field/', () => {
    const url = buildFieldLinkFromQuery('{service_name="myapp"}', 'ds-uid', TIME_RANGE_MS, 'status');
    expect(url).toContain('/explore/service/myapp/field/status');
  });

  it('encodes special characters in the field name', () => {
    const url = buildFieldLinkFromQuery('{service_name="myapp"}', 'ds-uid', TIME_RANGE_MS, 'some/field');
    expect(url).toContain('/field/some-field');
  });

  it('shares the same base params as buildServiceLinkFromQuery for the same query', () => {
    const serviceUrl = buildServiceLinkFromQuery('{service_name="myapp"}', 'ds-uid', TIME_RANGE_MS)!;
    const fieldUrl = buildFieldLinkFromQuery('{service_name="myapp"}', 'ds-uid', TIME_RANGE_MS, 'status')!;
    const serviceQs = new URLSearchParams(serviceUrl.split('?')[1]);
    const fieldQs = new URLSearchParams(fieldUrl.split('?')[1]);
    expect(fieldQs.get('var-ds')).toBe(serviceQs.get('var-ds'));
    expect(fieldQs.get('from')).toBe(serviceQs.get('from'));
    expect(fieldQs.get('to')).toBe(serviceQs.get('to'));
  });
});
