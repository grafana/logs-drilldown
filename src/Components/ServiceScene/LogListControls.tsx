import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { LogsSortOrder } from '@grafana/data';
import { GrafanaTheme2 } from '@grafana/data/';
import { config } from '@grafana/runtime';
import { Dropdown, IconButton, Menu, useStyles2 } from '@grafana/ui';
import { DownloadFormat } from 'services/export';

function downloadLogs(type: string) {
  //download(format, filteredLogs, logsMeta);
}

export const LogListControls = ({ sortOrder = LogsSortOrder.Ascending }) => {
  const styles = useStyles2(getStyles);

  const downloadMenu = useMemo(
    () => (
      <Menu>
        <Menu.Item label="txt" onClick={() => downloadLogs(DownloadFormat.Text)} />
        <Menu.Item label="json" onClick={() => downloadLogs(DownloadFormat.Json)} />
        <Menu.Item label="csv" onClick={() => downloadLogs(DownloadFormat.CSV)} />
      </Menu>
    ),
    []
  );

  return (
    <div className={styles.navContainer}>
      <IconButton
        name={sortOrder === LogsSortOrder.Descending ? 'sort-amount-up' : 'sort-amount-down'}
        className={styles.controlButton}
        onClick={() => {}}
        tooltip={sortOrder === LogsSortOrder.Descending ? 'Newest logs first' : 'Oldest logs first'}
        size="lg"
      />
      {!config.exploreHideLogsDownload && (
        <>
          <div className={styles.divider} />
          <Dropdown overlay={downloadMenu} placement="auto-end">
            <IconButton name="download-alt" className={styles.controlButton} tooltip={'Download logs'} size="lg" />
          </Dropdown>
        </>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    navContainer: css({
      maxHeight: '100%',
      display: 'flex',
      gap: theme.spacing(3),
      flexDirection: 'column',
      justifyContent: 'flex-start',
      width: theme.spacing(4),
      paddingTop: theme.spacing(0.75),
      paddingLeft: theme.spacing(1),
      borderLeft: `solid 1px ${theme.colors.border.medium}`,
    }),
    controlButton: css({
      margin: 0,
      color: theme.colors.text.secondary,
      height: theme.spacing(2),
    }),
    divider: css({
      borderTop: `solid 1px ${theme.colors.border.medium}`,
      height: 1,
      marginTop: theme.spacing(-0.25),
      marginBottom: theme.spacing(-1.75),
    }),
  };
};
