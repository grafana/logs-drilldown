import React from 'react';

import { toURLRange, urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

import { getDataSource, getQueryExpr } from 'services/scenes';
import { testIds } from 'services/testIds';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { USER_EVENTS_ACTIONS, USER_EVENTS_PAGES, reportAppInteraction } from 'services/analytics';
import { getDisplayedFields, getLogsVisualizationType } from 'services/store';
interface GoToExploreButtonState {
  exploration: IndexScene;
}

export const GoToExploreButton = ({ exploration }: GoToExploreButtonState) => {
  const onClick = () => {
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.open_in_explore_clicked
    );
    const datasource = getDataSource(exploration);
    const expr = getQueryExpr(exploration).replace(/\s+/g, ' ').trimEnd();
    const timeRange = sceneGraph.getTimeRange(exploration).state.value;
    const displayedFields = getDisplayedFields(exploration);
    const visualisationType = getLogsVisualizationType();
    const columns = getUrlColumns();
    const exploreState = JSON.stringify({
      ['loki-explore']: {
        range: toURLRange(timeRange.raw),
        queries: [{ refId: 'logs', expr, datasource }],
        panelsState: { logs: { displayedFields, visualisationType, columns } },
        datasource,
      },
    });
    const subUrl = config.appSubUrl ?? '';
    const link = urlUtil.renderUrl(`${subUrl}/explore`, { panes: exploreState, schemaVersion: 1 });
    window.open(link, '_blank');
  };

  return (
    <ToolbarButton
      data-testid={testIds.exploreServiceDetails.openExplore}
      variant={'canvas'}
      icon={'compass'}
      onClick={onClick}
    >
      Open in Explore
    </ToolbarButton>
  );
};

function getUrlColumns() {
  const params = new URLSearchParams(window.location.search);
  const urlColumns = params.get('urlColumns');
  if (urlColumns) {
    try {
      const columns: string[] = JSON.parse(urlColumns);
      let columnsParam: Record<number, string> = {};
      for (const key in columns) {
        columnsParam[key] = columns[key];
      }
      return columnsParam;
    } catch (e) {
      console.error(e);
    }
  }
  return undefined;
}
