import { getEnvironment, resolveEnvironmentFromHost } from 'faro/getEnv';

describe('resolveEnvironmentFromHost()', () => {
  test.each([
    [undefined, null],
    ['', null],
    ['localhost', 'local'],
    ['localhost:3000', 'local'],
    ['127.0.0.1', 'local'],
    ['127.0.0.1:3001', 'local'],
    ['grafana-dev.net', 'dev'],
    ['test.grafana-dev.net', 'dev'],
    ['foobar.grafana-ops.net', 'ops'],
    ['grafana-ops.net', 'ops'],
    ['foobar.grafana.net', 'prod'],
    ['grafana.net', 'prod'],
    ['my.example.com', null],
    ['localhost-prod.example.com', null],
  ])('when the host is %s → %s', (host, expectedEnvironment) => {
    expect(resolveEnvironmentFromHost(host)).toBe(expectedEnvironment);
  });
});

describe('getEnvironment()', () => {
  test('delegates to window.location.host (jsdom default is localhost)', () => {
    expect(getEnvironment()).toBe('local');
  });
});
