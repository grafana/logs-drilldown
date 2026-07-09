import React, { type ComponentProps } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { Dropdown, Menu, ToolbarButton, useStyles2 } from '@grafana/ui';

import { plugin } from '../../module';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { getPluginConfigPageLocation } from '../../services/plugin';
import { testIds } from '../../services/testIds';
import { LokiLogo } from './LokiLogo';

const PLUGIN_REPO = 'https://github.com/grafana/logs-drilldown';
const DOCUMENTATION_URL = 'https://grafana.com/docs/grafana/latest/visualizations/simplified-exploration/logs/';
const FEEDBACK_FORM_URL = 'https://forms.gle/1sYWCTPvD72T1dPH9';

const { buildInfo: grafanaBuildInfo } = config;

/** CI appends the git SHA to the plugin version (e.g. `2.1.5+abc123…`). */
function getCommitShaFromVersion(version: string | undefined): string | undefined {
  if (version == null) {
    return undefined;
  }
  const suffixIndex = version.lastIndexOf('+');
  if (suffixIndex === -1) {
    return undefined;
  }
  const sha = version.slice(suffixIndex + 1);
  return /^[0-9a-f]+$/i.test(sha) ? sha : undefined;
}

function InfoMenuHeader() {
  const styles = useStyles2(getStyles);
  const version = plugin.meta.info?.version ?? '?.?.?';
  const updated = plugin.meta.info?.updated ?? '?';

  return (
    <div className={styles.menuHeader}>
      <h5>
        <LokiLogo />
        {t('plugin-info.header.title', 'Grafana Logs Drilldown v{{version}}', { version })}
      </h5>
      <div className={styles.subTitle}>
        {t('plugin-info.header.last-update', 'Last update: {{updated}}', { updated })}
      </div>
    </div>
  );
}

function InfoMenu() {
  const commitSha = getCommitShaFromVersion(plugin.meta.info?.version);
  const shortCommitSha = commitSha?.slice(0, 8) ?? 'dev';
  const pluginCommitUrl = commitSha ? `${PLUGIN_REPO}/commit/${commitSha}` : undefined;

  return (
    <Menu header={<InfoMenuHeader />}>
      <Menu.Item
        label={t('plugin-info.menu.commit-sha', 'Commit SHA: {{shortCommitSha}}', { shortCommitSha })}
        icon="github"
        disabled={!pluginCommitUrl}
        onClick={() => {
          if (pluginCommitUrl) {
            window.open(pluginCommitUrl, '_blank', 'noopener,noreferrer');
          }
        }}
      />
      <Menu.Item
        label={t('plugin-info.menu.changelog', 'Changelog')}
        icon="list-ul"
        onClick={() => window.open(`${PLUGIN_REPO}/releases`, '_blank', 'noopener,noreferrer')}
      />
      <Menu.Item
        label={t('plugin-info.menu.contribute', 'Contribute')}
        icon="external-link-alt"
        onClick={() => window.open(`${PLUGIN_REPO}/blob/main/CONTRIBUTING.md`, '_blank', 'noopener,noreferrer')}
      />
      <Menu.Item
        label={t('plugin-info.menu.documentation', 'Documentation')}
        icon="document-info"
        onClick={() => {
          reportAppInteraction(USER_EVENTS_PAGES.all, USER_EVENTS_ACTIONS.all.documentation_link_clicked);
          window.open(DOCUMENTATION_URL, '_blank', 'noopener,noreferrer');
        }}
      />
      <Menu.Item
        label={t('plugin-info.menu.give-feedback', 'Give feedback')}
        icon="comment-alt-message"
        onClick={() => {
          reportAppInteraction(USER_EVENTS_PAGES.all, USER_EVENTS_ACTIONS.all.feedback_link_clicked);
          window.open(FEEDBACK_FORM_URL, '_blank', 'noopener,noreferrer');
        }}
      />
      <Menu.Item
        label={t('plugin-info.menu.report-issue', 'Report an issue')}
        icon="bug"
        onClick={() => window.open(`${PLUGIN_REPO}/issues/new?template=bug_report.md`, '_blank', 'noopener,noreferrer')}
      />
      <Menu.Item
        label={t('plugin-info.menu.configuration', 'Plugin configuration')}
        icon="cog"
        onClick={() => {
          reportAppInteraction(USER_EVENTS_PAGES.all, USER_EVENTS_ACTIONS.all.plugin_configuration_clicked);
          locationService.push(getPluginConfigPageLocation());
        }}
      />
      <Menu.Divider />
      <Menu.Item
        label={t('plugin-info.menu.grafana-version', 'Grafana {{edition}} ({{env}})', {
          edition: grafanaBuildInfo.edition,
          env: grafanaBuildInfo.env,
        })}
        icon="grafana"
        onClick={() =>
          window.open(
            `https://github.com/grafana/grafana/commit/${grafanaBuildInfo.commit}`,
            '_blank',
            'noopener,noreferrer'
          )
        }
      />
    </Menu>
  );
}

export function PluginInfo({ variant = 'canvas' }: { variant?: ComponentProps<typeof ToolbarButton>['variant'] }) {
  return (
    <Dropdown overlay={<InfoMenu />} placement="bottom-end">
      <ToolbarButton
        icon="info-circle"
        variant={variant}
        aria-label={t('plugin-info.button.title', 'Plugin info')}
        tooltip={t('plugin-info.button.tooltip', 'Plugin info')}
        data-testid={testIds.header.pluginInfoButton}
      />
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  menuHeader: css({
    padding: theme.spacing(0.5, 1),
    whiteSpace: 'nowrap',
  }),
  subTitle: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
