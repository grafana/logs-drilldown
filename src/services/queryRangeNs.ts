import { locationService } from '@grafana/runtime';
import { type SceneTimeRangeLike } from '@grafana/scenes';

export function getQueryRangeNs() {
  const params = new URLSearchParams(locationService.getLocation().search);
  return { startNs: params.get('startNs') ?? undefined, endNs: params.get('endNs') ?? undefined };
}

export function clearQueryRangeNsOnTimeChange(timeRange: SceneTimeRangeLike) {
  return timeRange.subscribeToState((next, previous) => {
    if (
      next.value.from.valueOf() === previous.value.from.valueOf() &&
      next.value.to.valueOf() === previous.value.to.valueOf()
    ) {
      return;
    }
    const params = new URLSearchParams(locationService.getLocation().search);
    if (!params.has('startNs') && !params.has('endNs')) {
      return;
    }
    // URL navigation already carries the new range; a picker change still has the old URL here.
    if (params.get('from') === next.from && params.get('to') === next.to) {
      return;
    }
    // Change the range and bounds in one history step so Back restores the complete shared link.
    locationService.partial(
      { from: next.from, to: next.to, startNs: null, endNs: null },
      !timeRange.urlSync?.shouldCreateHistoryStep?.({})
    );
  });
}
