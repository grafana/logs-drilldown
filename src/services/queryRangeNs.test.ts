import { locationService } from '@grafana/runtime';
import { EmbeddedScene, SceneFlexLayout, SceneTimeRange, UrlSyncManager } from '@grafana/scenes';

import { clearQueryRangeNsOnTimeChange, getQueryRangeNs } from './queryRangeNs';

describe('nanosecond link range lifecycle', () => {
  it('restores a link, clears bounds on a picker change, and restores them with browser Back', () => {
    const previousLocation = locationService.getLocation();
    locationService.push('/explore?from=1970-01-01T00:00:01.000Z&to=1970-01-01T00:00:02.000Z&endNs=1999000124');
    const timeRange = new SceneTimeRange();
    const scene = new EmbeddedScene({ $timeRange: timeRange, body: new SceneFlexLayout({ children: [] }) });
    const manager = new UrlSyncManager({ createBrowserHistorySteps: true });
    const subscription = clearQueryRangeNsOnTimeChange(timeRange);
    manager.initSync(scene);
    const deactivate = scene.activate();
    const unlisten = locationService
      .getHistory()
      .listen((location: ReturnType<typeof locationService.getLocation>) => manager.handleNewLocation(location));
    try {
      expect(timeRange.state.value.to.valueOf()).toBe(2000);
      expect(getQueryRangeNs()).toEqual({ startNs: undefined, endNs: '1999000124' });
      timeRange.onRefresh();
      expect(getQueryRangeNs().endNs).toBe('1999000124');

      timeRange.onTimeRangeChange(
        new SceneTimeRange({ from: timeRange.state.from, to: '1970-01-01T00:00:03.000Z' }).state.value
      );
      expect(timeRange.state.value.to.valueOf()).toBe(3000);
      expect(getQueryRangeNs()).toEqual({ startNs: undefined, endNs: undefined });

      locationService.getHistory().goBack();
      expect(timeRange.state.value.to.valueOf()).toBe(2000);
      expect(getQueryRangeNs().endNs).toBe('1999000124');
      locationService.getHistory().goForward();
      expect(timeRange.state.value.to.valueOf()).toBe(3000);
      expect(getQueryRangeNs()).toEqual({ startNs: undefined, endNs: undefined });
    } finally {
      unlisten();
      subscription.unsubscribe();
      manager.cleanUp(scene);
      deactivate();
      locationService.replace(previousLocation);
    }
  });
});
