import React, { useCallback, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Icon, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { LineLimitScene } from '../ServiceScene/LineLimitScene';
import { toggleLogsListPanelSize } from 'services/scenes';
import { getExpandedLogsView, LogsVisualizationType, setExpandedLogsView } from 'services/store';

export interface LogsPanelHeaderActionsProps {
  lineLimitScene: LineLimitScene;
  onChange: (type: LogsVisualizationType) => void;
  vizType: LogsVisualizationType;
}

/**
 * Viz toggle and line limit for the logs panel header row.
 */
export function LogsPanelHeaderActions({ lineLimitScene, onChange, vizType }: LogsPanelHeaderActionsProps) {
  const [logsExpanded, setLogsExpanded] = useState(getExpandedLogsView(lineLimitScene));
  const styles = useStyles2(getStyles);

  const toggleLogsSize = useCallback(() => {
    const newState = !getExpandedLogsView(lineLimitScene);
    setExpandedLogsView(lineLimitScene, newState);
    setLogsExpanded(newState);
    toggleLogsListPanelSize(lineLimitScene, newState);
    reportInteraction('grafana_logs_app_toggle_logs_size_clicked', {
      expanded: newState,
    });
  }, [lineLimitScene]);

  return (
    <div className={styles.toolbar}>
      <Button
        size="sm"
        variant="secondary"
        fill="outline"
        onClick={toggleLogsSize}
        tooltip={
          logsExpanded
            ? t('components.service-scene.log-options-buttons-scene.tooltip.condense-logs', 'Condense logs view')
            : t('components.service-scene.log-options-buttons-scene.tooltip.expand-logs', 'Expand logs view')
        }
      >
        <Icon size="sm" name={logsExpanded ? 'compress-arrows' : 'expand-arrows'} />
      </Button>
      <RadioButtonGroup
        options={[
          {
            description: t(
              'components.table.logs-header-actions.description.show-results-in-logs-visualisation',
              'Show results in logs visualisation'
            ),
            label: t('components.table.logs-header-actions.label.logs', 'Logs'),
            value: 'logs',
          },
          {
            description: t(
              'components.table.logs-header-actions.description.show-results-in-table-visualisation',
              'Show results in table visualisation'
            ),
            label: t('components.table.logs-header-actions.label.table', 'Table'),
            value: 'table',
          },
          {
            description: t(
              'components.table.logs-header-actions.description.show-results-in-json-visualisation',
              'Show results in json visualisation'
            ),
            label: t('components.table.logs-header-actions.label.json', 'JSON'),
            value: 'json',
          },
        ]}
        size="sm"
        value={vizType}
        onChange={onChange}
      />
      <lineLimitScene.Component model={lineLimitScene} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  toolbar: css({
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    flexShrink: 0,
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    [theme.breakpoints.down(theme.breakpoints.values.md)]: {
      flexWrap: 'nowrap',
    },
  }),
});
