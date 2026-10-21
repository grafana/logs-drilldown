import React, { useState } from 'react';

import { css } from '@emotion/css';

import {
  formattedValueToString,
  GrafanaTheme2,
  IconName,
  LoadingState,
  PanelData,
  QueryResultMetaNotice,
  QueryResultMetaStat,
  getValueFormat,
  textUtil,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Alert, Button, Drawer, Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { IndexScene } from 'Components/IndexScene/IndexScene';
import { testIds } from 'services/testIds';

const TOTAL_BYTES_STAT = 'Summary: total bytes processed';

interface LogsQueryFooterState extends SceneObjectState {
  data?: PanelData;
}

export class LogsQueryFooter extends SceneObjectBase<LogsQueryFooterState> {
  public static Component = LogsQueryFooterRenderer;

  constructor() {
    super({});
    this.addActivationHandler(this.subscribeToQueryData.bind(this));
  }

  private subscribeToQueryData() {
    const queryRunner = sceneGraph.getData(this);
    this.setState({ data: queryRunner.state.data });

    const subscription = queryRunner.subscribeToState((newState) => {
      if (newState.data !== this.state.data) {
        this.setState({ data: newState.data });
      }
    });

    return () => subscription.unsubscribe();
  }
}

function LogsQueryFooterRenderer({ model }: SceneComponentProps<LogsQueryFooter>) {
  const styles = useStyles2(getStyles);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { data } = model.useState();
  const indexScene = sceneGraph.getAncestor(model, IndexScene);
  const { embedded } = indexScene.useState();
  const statusMessage = getQueryStatusMessage(data);

  if (statusMessage) {
    return (
      <footer className={styles.footer} data-testid={testIds.logsQueryFooter.footer}>
        <div className={styles.summary}>{statusMessage}</div>
      </footer>
    );
  }

  const stats = getQueryRunnerStats(data) ?? [];
  const notices = getQueryRunnerNotices(data) ?? [];
  const totalBytes = stats.find((stat) => stat.displayName === TOTAL_BYTES_STAT);

  return (
    <footer className={styles.footer} data-testid={testIds.logsQueryFooter.footer}>
      <div className={styles.summary}>
        {totalBytes && (
          <Tooltip
            content={t(
              'components.service-scene.logs-query-footer.total-bytes-processed-tooltip',
              'Bytes processed by the logs query.'
            )}
          >
            <span className={styles.totalBytes}>
              {t('components.service-scene.logs-query-footer.total-bytes-processed', 'Total bytes processed')}:
              <span className={styles.value}>{formatQueryStat(totalBytes)}</span>
            </span>
          </Tooltip>
        )}
        {notices.map((notice, index) => (
          <NoticeItem key={`${notice.severity}-${index}`} notice={notice} styles={styles} />
        ))}
      </div>
      <Button
        fill="text"
        variant="secondary"
        size="sm"
        disabled={embedded}
        onClick={() => setDetailsOpen(true)}
        data-testid={testIds.logsQueryFooter.details}
      >
        {t('components.service-scene.logs-query-footer.view-details', 'View details')}
      </Button>
      {detailsOpen && (
        <Drawer
          title={t('components.service-scene.logs-query-footer.details-title', 'Query details')}
          onClose={() => setDetailsOpen(false)}
          size="sm"
        >
          <QueryDetails stats={stats} notices={notices} />
        </Drawer>
      )}
    </footer>
  );
}

function getQueryStatusMessage(data: PanelData | undefined) {
  if (!data) {
    return t('components.service-scene.logs-query-footer.no-data', 'No data');
  }
  if (data.state === LoadingState.Loading) {
    return t('components.service-scene.logs-query-footer.loading', 'Loading');
  }
  if (data.state === LoadingState.Streaming) {
    return t('components.service-scene.logs-query-footer.streaming', 'Streaming');
  }
  if (data.state === LoadingState.Error) {
    return t('components.service-scene.logs-query-footer.error', 'Error');
  }
  return undefined;
}

function getQueryRunnerNotices(data: PanelData | undefined): QueryResultMetaNotice[] | undefined {
  for (const frame of data?.series ?? []) {
    const notices = frame.meta?.notices;
    if (notices?.length) {
      return notices;
    }
  }
  return undefined;
}

function getQueryRunnerStats(data: PanelData | undefined): QueryResultMetaStat[] | undefined {
  for (const frame of data?.series ?? []) {
    const stats = frame.meta?.stats;
    if (stats?.length) {
      return stats;
    }
  }
  return undefined;
}

function QueryDetails({ stats, notices }: { notices: QueryResultMetaNotice[]; stats: QueryResultMetaStat[] }) {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={2}>
      {notices.length > 0 && (
        <Stack direction="column" gap={1}>
          <Text element="h4">{t('components.service-scene.logs-query-footer.notices', 'Notices')}</Text>
          {notices.map((notice, index) => (
            <Alert key={`${notice.severity}-${index}`} severity={notice.severity} title={notice.text}>
              <NoticeLink notice={notice} />
            </Alert>
          ))}
        </Stack>
      )}
      <Stack direction="column" gap={0}>
        <Text element="h4">{t('components.service-scene.logs-query-footer.stats', 'Stats')}</Text>
        {stats.map((stat) => (
          <div key={stat.displayName} className={styles.statRow}>
            <span>{stat.displayName}</span>
            <span className={styles.value}>{formatQueryStat(stat)}</span>
          </div>
        ))}
      </Stack>
    </Stack>
  );
}

function NoticeItem({ notice, styles }: { notice: QueryResultMetaNotice; styles: ReturnType<typeof getStyles> }) {
  return (
    <span className={styles.notice} title={notice.text}>
      <Icon name={noticeIcon(notice.severity)} size="sm" className={severityClass(styles, notice.severity)} />
      <span className={styles.noticeText}>
        <NoticeBody notice={notice} />
      </span>
    </span>
  );
}

function NoticeBody({ notice }: { notice: QueryResultMetaNotice }) {
  if (!safeNoticeHref(notice.link)) {
    return <>{notice.text}</>;
  }

  return (
    <>
      {notice.text} <NoticeLink notice={notice} />
    </>
  );
}

function NoticeLink({ notice }: { notice: QueryResultMetaNotice }) {
  const href = safeNoticeHref(notice.link);
  if (!href) {
    return null;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer">
      {t('components.service-scene.logs-query-footer.notice-link', 'Learn more')}
    </a>
  );
}

function formatQueryStat(stat: QueryResultMetaStat) {
  const formatter = getValueFormat(stat.unit);
  return formattedValueToString(formatter(stat.value, stat.decimals));
}

function noticeIcon(severity: QueryResultMetaNotice['severity']): IconName {
  if (severity === 'error') {
    return 'exclamation-circle';
  }
  if (severity === 'warning') {
    return 'exclamation-triangle';
  }
  return 'info-circle';
}

function severityClass(styles: ReturnType<typeof getStyles>, severity: QueryResultMetaNotice['severity']) {
  if (severity === 'error') {
    return styles.error;
  }
  if (severity === 'warning') {
    return styles.warning;
  }
  return styles.info;
}

function safeNoticeHref(link: string | undefined) {
  if (!link) {
    return undefined;
  }
  const sanitized = textUtil.sanitizeUrl(link);
  if (sanitized.startsWith('https://') || sanitized.startsWith('http://') || sanitized.startsWith('/')) {
    return sanitized;
  }
  return undefined;
}

const getStyles = (theme: GrafanaTheme2) => ({
  error: css({
    color: theme.colors.error.text,
  }),
  footer: css({
    alignItems: 'center',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    display: 'flex',
    gap: theme.spacing(2),
    justifyContent: 'space-between',
    padding: theme.spacing(0.5, 1),
    width: '100%',
  }),
  info: css({
    color: theme.colors.info.text,
  }),
  notice: css({
    alignItems: 'center',
    display: 'inline-flex',
    gap: theme.spacing(0.5),
    maxWidth: '100%',
    minWidth: 0,
  }),
  noticeText: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  statRow: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    gap: theme.spacing(2),
    justifyContent: 'space-between',
    padding: theme.spacing(1, 0),
  }),
  totalBytes: css({
    alignItems: 'center',
    display: 'inline-flex',
    gap: theme.spacing(0.5),
  }),
  summary: css({
    alignItems: 'center',
    color: theme.colors.text.secondary,
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: theme.typography.bodySmall.fontSize,
    gap: theme.spacing(2),
    minWidth: 0,
  }),
  value: css({
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  warning: css({
    color: theme.colors.warning.text,
  }),
});
