import React, { useState } from 'react';

import { css } from '@emotion/css';

import { AppPluginMeta, GrafanaTheme2, PluginConfigPageProps } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Field, FieldSet, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { JsonData, updatePlugin } from '../AppConfig';
import { FeatureFlagContext } from 'Components/FeatureFlagContext';
import { LogDefaults } from 'services/logDefaults';
import { logger } from 'services/logger';
import { testIds } from 'services/testIds';

type Props = PluginConfigPageProps<AppPluginMeta<JsonData>>;

const LogDefaultsConfig = ({ plugin }: Props) => {
  const styles = useStyles2(getStyles);
  const { enabled, jsonData, pinned } = plugin.meta;
  const [defaults, setDefaults] = useState<LogDefaults>(jsonData?.logDefaults ?? {});
  const [saved, setSaved] = useState(false);

  const update = (next: LogDefaults) => {
    setSaved(false);
    setDefaults(next);
  };

  const onSave = async () => {
    // Drop unset keys so users fall through to the built-in defaults
    const logDefaults = Object.fromEntries(Object.entries(defaults).filter(([, v]) => v !== undefined));
    try {
      await updatePlugin(plugin.meta.id, {
        enabled,
        jsonData: { ...jsonData, logDefaults: Object.keys(logDefaults).length ? logDefaults : undefined },
        pinned,
      });
      setSaved(true);
    } catch (e) {
      logger.error(e, { msg: 'Error while updating the log defaults' });
    }
  };

  const notSet = { label: t('components.app-config.log-defaults.not-set', 'Not set'), value: undefined };

  return (
    <FeatureFlagContext>
      <div data-testid={testIds.appConfig.logDefaults.container}>
        <FieldSet label={t('components.app-config.log-defaults.label-log-defaults', 'Log defaults')}>
          <p className={styles.intro}>
            <Trans i18nKey="components.app-config.log-defaults.description">
              Defaults for how logs are displayed. They apply to users who have not changed the option themselves.
              Options a user changed in Logs Drilldown take precedence, and users can reset them to these defaults.
            </Trans>
          </p>

          <Field label={t('components.app-config.log-defaults.label-line-wrapping', 'Line wrapping')}>
            <RadioButtonGroup
              options={[
                notSet,
                { label: t('components.app-config.log-defaults.wrap', 'Wrap'), value: true },
                { label: t('components.app-config.log-defaults.no-wrap', 'No wrap'), value: false },
              ]}
              value={defaults.wrapLogMessage}
              onChange={(wrapLogMessage) => update({ ...defaults, wrapLogMessage })}
            />
          </Field>

          <Field label={t('components.app-config.log-defaults.label-timestamps', 'Timestamps')}>
            <RadioButtonGroup
              options={[
                notSet,
                { label: t('components.app-config.log-defaults.show', 'Show'), value: true },
                { label: t('components.app-config.log-defaults.hide', 'Hide'), value: false },
              ]}
              value={defaults.showTime}
              onChange={(showTime) => update({ ...defaults, showTime })}
            />
          </Field>

          <Field label={t('components.app-config.log-defaults.label-font-size', 'Font size')}>
            <RadioButtonGroup
              options={[
                notSet,
                { label: t('components.app-config.log-defaults.font-default', 'Default'), value: 'default' as const },
                { label: t('components.app-config.log-defaults.font-small', 'Small'), value: 'small' as const },
              ]}
              value={defaults.fontSize}
              onChange={(fontSize) => update({ ...defaults, fontSize })}
            />
          </Field>

          <Field label={t('components.app-config.log-defaults.label-sort-order', 'Sort order')}>
            <RadioButtonGroup
              options={[
                notSet,
                {
                  label: t('components.app-config.log-defaults.newest-first', 'Newest first'),
                  value: 'Descending' as const,
                },
                {
                  label: t('components.app-config.log-defaults.oldest-first', 'Oldest first'),
                  value: 'Ascending' as const,
                },
              ]}
              value={defaults.sortOrder}
              onChange={(sortOrder) => update({ ...defaults, sortOrder })}
            />
          </Field>

          <Button type="submit" data-testid={testIds.appConfig.logDefaults.submit} onClick={onSave}>
            <Trans i18nKey="components.app-config.log-defaults.save">Save defaults</Trans>
          </Button>
          {saved && (
            <Alert className={styles.note} severity="success" title="">
              <Trans i18nKey="components.app-config.log-defaults.saved">
                Saved. Active users must reload the app to reflect the new defaults.
              </Trans>
            </Alert>
          )}
        </FieldSet>
      </div>
    </FeatureFlagContext>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  intro: css({ color: theme.colors.text.secondary, marginBottom: theme.spacing(3) }),
  note: css({ marginTop: theme.spacing(2) }),
});

export default LogDefaultsConfig;
