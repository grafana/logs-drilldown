import { LogsSortOrder, toURLRange, urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';

import { DATAPLANE_LABELS_NAME } from '../../services/logsFrame';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { getDataSource, getQueryExpr } from 'services/scenes';
import { getDisplayedFields, getLogOption, getLogsVisualizationType } from 'services/store';

export const onExploreLinkClick = (indexScene: IndexScene, expr?: string, open = false) => {
  if (!expr) {
    expr = getQueryExpr(indexScene);
  }

  expr = expr.replace(/\s+/g, ' ').trimEnd();

  const datasource = getDataSource(indexScene);
  const timeRange = sceneGraph.getTimeRange(indexScene).state.value;
  const displayedFields = getDisplayedFields(indexScene);
  const visualisationType = getLogsVisualizationType();

  // Convert displayedFields array to columns object format for explore
  let columns: Record<number, string> | undefined;
  if (displayedFields && displayedFields.length > 0) {
    columns = {};
    displayedFields.forEach((field, index) => {
      columns![index] = field;
    });
  }

  /* eslint-disable sort/object-properties */
  const exploreState = JSON.stringify({
    ['loki-explore']: {
      range: toURLRange(timeRange.raw),
      queries: [{ refId: 'logs', expr, datasource }],
      panelsState: {
        logs: {
          displayedFields,
          visualisationType: visualisationType === 'json' ? 'logs' : visualisationType,
          columns,
          labelFieldName: visualisationType === 'table' ? DATAPLANE_LABELS_NAME : undefined,
          sortOrder: getLogOption('sortOrder', LogsSortOrder.Descending),
        },
      },
      datasource,
    },
  });
  const subUrl = config.appSubUrl ?? '';
  const link = urlUtil.renderUrl(`${subUrl}/explore`, { panes: exploreState, schemaVersion: 1 });
  if (open) {
    window.open(link, '_blank');
  }

  return link;
};
