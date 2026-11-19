import { LogsSortOrder } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { plugin } from '../../module';
import { JSONLogsScene } from './JSONLogsScene';
import { LogsListScene } from './LogsListScene';
import { LogsPanelScene } from './LogsPanelScene';
import { LogsTablePanelScene } from './LogsTablePanelScene';

jest.mock('../../module', () => ({ plugin: { meta: { jsonData: {} } } }));

describe('default visualization', () => {
  beforeEach(() => {
    locationService.replace('/a/grafana-lokiexplore-app/explore');
    localStorage.clear();
    plugin.meta.jsonData = {};
  });

  afterEach(() => {
    locationService.replace('/a/grafana-lokiexplore-app/explore');
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

  it.each(['logs', 'table', 'json'] as const)('initializes the %s visualization directly from the URL', (type) => {
    plugin.meta.jsonData = { defaultVisualizationType: 'table' };
    localStorage.setItem('grafana.explore.logs.visualisationType', 'json');
    const params = new URLSearchParams({ visualizationType: JSON.stringify(type) });
    locationService.replace(`/a/grafana-lokiexplore-app/explore?${params}`);
    expect(new LogsListScene({}).state.visualizationType).toBe(type);
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

  it('applies independent configured sort orders to each visualization', () => {
    plugin.meta.jsonData = {
      defaultSortOrder: LogsSortOrder.Ascending,
      defaultTableSortOrder: LogsSortOrder.Descending,
      defaultJSONSortOrder: LogsSortOrder.Ascending,
    };
    expect(new LogsPanelScene({}).state.sortOrder).toBe(LogsSortOrder.Ascending);
    expect(new LogsTablePanelScene({}).state.sortOrder).toBe(LogsSortOrder.Descending);
    expect(new JSONLogsScene({}).state.sortOrder).toBe(LogsSortOrder.Ascending);
  });

  it('preserves the saved sort order across all visualizations', () => {
    plugin.meta.jsonData = {
      defaultSortOrder: LogsSortOrder.Ascending,
      defaultTableSortOrder: LogsSortOrder.Ascending,
      defaultJSONSortOrder: LogsSortOrder.Ascending,
    };
    localStorage.setItem('grafana.explore.logs.sortOrder', LogsSortOrder.Descending);
    expect(new LogsPanelScene({}).state.sortOrder).toBe(LogsSortOrder.Descending);
    expect(new LogsTablePanelScene({}).state.sortOrder).toBe(LogsSortOrder.Descending);
    expect(new JSONLogsScene({}).state.sortOrder).toBe(LogsSortOrder.Descending);
  });

  it('applies JSON wrapping and highlighting defaults without saving browser preferences', () => {
    plugin.meta.jsonData = { defaultJSONWrapLogMessage: false, defaultJSONSyntaxHighlighting: true };
    expect(new JSONLogsScene({}).state).toMatchObject({ wrapLogMessage: false, hasHighlight: true });
    expect(localStorage.length).toBe(0);
  });

  it('preserves explicitly disabled JSON highlighting and enabled wrapping preferences', () => {
    plugin.meta.jsonData = { defaultJSONWrapLogMessage: false, defaultJSONSyntaxHighlighting: true };
    localStorage.setItem('grafana.explore.logs.wrapLogMessage', 'true');
    localStorage.setItem('grafana-lokiexplore-app.jsonViz.highlight', '');
    expect(new JSONLogsScene({}).state).toMatchObject({ wrapLogMessage: true, hasHighlight: false });
  });

  it('applies false JSON wrapping and sort order from the URL ahead of defaults', () => {
    plugin.meta.jsonData = { defaultJSONWrapLogMessage: true, defaultJSONSortOrder: LogsSortOrder.Ascending };
    const panel = new JSONLogsScene({});
    panel.updateFromUrl({ wrapLogMessage: 'false', sortOrder: JSON.stringify(LogsSortOrder.Descending) });
    expect(panel.state).toMatchObject({ wrapLogMessage: false, sortOrder: LogsSortOrder.Descending });
  });
});
