import { plugin } from '../../module';
import { LogsListScene } from './LogsListScene';
import { LogsPanelScene } from './LogsPanelScene';

jest.mock('../../module', () => ({ plugin: { meta: { jsonData: {} } } }));

describe('default visualization', () => {
  beforeEach(() => {
    localStorage.clear();
    plugin.meta.jsonData = {};
  });

  it('uses Logs without a browser preference or configured default', () => {
    expect(new LogsListScene({}).state.visualizationType).toBe('logs');
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

  it('falls back to the configured default when the saved browser preference is invalid', () => {
    plugin.meta.jsonData = { defaultVisualizationType: 'table' };
    localStorage.setItem('grafana.explore.logs.visualisationType', 'invalid');
    expect(new LogsListScene({}).state.visualizationType).toBe('table');
  });

  it('uses configured line wrapping and formatting without saving browser preferences', () => {
    plugin.meta.jsonData = { defaultWrapLogMessage: true, defaultPrettifyLogMessage: true };
    expect(new LogsPanelScene({}).state).toMatchObject({ wrapLogMessage: true, prettifyLogMessage: true });
    expect(localStorage.length).toBe(0);
  });

  it('keeps saved false wrapping and formatting preferences ahead of the configured defaults', () => {
    plugin.meta.jsonData = { defaultWrapLogMessage: true, defaultPrettifyLogMessage: true };
    localStorage.setItem('grafana.explore.logs.wrapLogMessage', 'false');
    localStorage.setItem('grafana.explore.logs.prettifyLogMessage', 'false');
    expect(new LogsPanelScene({}).state).toMatchObject({ wrapLogMessage: false, prettifyLogMessage: false });
  });

  it('keeps URL wrapping and formatting ahead of configured defaults', () => {
    plugin.meta.jsonData = { defaultWrapLogMessage: true, defaultPrettifyLogMessage: true };
    const panel = new LogsPanelScene({});
    panel.updateFromUrl({ wrapLogMessage: 'false', prettifyLogMessage: 'false' });
    expect(panel.state).toMatchObject({ wrapLogMessage: false, prettifyLogMessage: false });
  });
});
