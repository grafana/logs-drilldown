import { plugin } from '../../module';
import { LogsListScene } from './LogsListScene';

jest.mock('../../module', () => ({ plugin: { meta: { jsonData: {} } } }));

describe('default visualization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each(['logs', 'table', 'json'] as const)('initializes the panel with the configured %s view', (type) => {
    plugin.meta.jsonData = { defaultVisualizationType: type };
    expect(new LogsListScene({}).state.visualizationType).toBe(type);
  });

  it('keeps a visualization specified in the URL ahead of the administrator default and browser preference', () => {
    plugin.meta.jsonData = { defaultVisualizationType: 'table' };
    localStorage.setItem('grafana.explore.logs.visualisationType', 'json');
    const scene = new LogsListScene({});
    expect(scene.state.visualizationType).toBe('json');
    scene.updateFromUrl({ visualizationType: JSON.stringify('logs') });
    expect(scene.state.visualizationType).toBe('logs');
  });
});
