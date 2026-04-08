import React, { ChangeEvent, useState } from 'react';

import { css } from '@emotion/css';
import { isNumber } from 'lodash';
import { lastValueFrom } from 'rxjs';

import {
  AppPluginMeta,
  DataSourceInstanceSettings,
  getTimeZone,
  GrafanaTheme2,
  PluginConfigPageProps,
  PluginMeta,
  rangeUtil,
} from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { DataSourcePicker, getBackendSrv, locationService } from '@grafana/runtime';
import { Alert, Button, Checkbox, Field, FieldSet, Input, useStyles2 } from '@grafana/ui';

import { logger } from '../../services/logger';
import { getDefaultDatasourceFromDatasourceSrv, getLastUsedDataSourceFromStorage } from '../../services/store';
import { isValidTimeRange } from 'services/utils';

export type JsonData = {
  dataSource?: string;
  /** When set, used as the initial time range when opening the app (if URL has no from/to). */
  defaultTimeRange?: { from: string; to: string };
  interval?: string;
  patternsDisabled?: boolean;
};

type State = {
  dataSource: string;
  defaultTimeRangeEnabled: boolean;
  defaultTimeRangeFrom: string;
  defaultTimeRangeTo: string;
  interval: string;
  isValid: boolean;
  patternsDisabled: boolean;
};

// 1 hour minimum
const MIN_INTERVAL_SECONDS = 3600;

type DefaultTimeRangeValidation = { valid: true } | { error: string; valid: false };

function validateDefaultTimeRange(from: string, to: string): DefaultTimeRangeValidation {
  const fromTrimmed = from.trim();
  const toTrimmed = to.trim();
  if (!fromTrimmed || !toTrimmed) {
    return { valid: false, error: 'From and To are required.' };
  }
  try {
    const timeZone = getTimeZone();
    const range = rangeUtil.convertRawToRange({ from: fromTrimmed, to: toTrimmed }, timeZone);
    if (!range || !isValidTimeRange(range)) {
      return { valid: false, error: 'Invalid time range. Use relative times (e.g. now-15m, now-1h, now) or absolute.' };
    }
    if (range.from.valueOf() >= range.to.valueOf()) {
      return { valid: false, error: 'To must be after From.' };
    }
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'Invalid time range. Use relative times (e.g. now-15m, now-1h, now) or absolute.',
    };
  }
}

interface Props extends PluginConfigPageProps<AppPluginMeta<JsonData>> {}

const AppConfig = ({ plugin }: Props) => {
  const styles = useStyles2(getStyles);
  const { enabled, jsonData, pinned } = plugin.meta;

  const hasDefaultTimeRange = jsonData?.defaultTimeRange != null;
  const [state, setState] = useState<State>({
    dataSource:
      jsonData?.dataSource ?? getDefaultDatasourceFromDatasourceSrv() ?? getLastUsedDataSourceFromStorage() ?? '',
    interval: jsonData?.interval ?? '',
    isValid: isValid(jsonData?.interval ?? ''),
    patternsDisabled: jsonData?.patternsDisabled ?? false,
    defaultTimeRangeEnabled: hasDefaultTimeRange,
    defaultTimeRangeFrom: jsonData?.defaultTimeRange?.from ?? 'now-15m',
    defaultTimeRangeTo: jsonData?.defaultTimeRange?.to ?? 'now',
  });

  const onChangeDatasource = (ds: DataSourceInstanceSettings) => {
    setState({
      ...state,
      dataSource: ds.uid,
    });
  };

  const onChangeInterval = (event: ChangeEvent<HTMLInputElement>) => {
    const interval = event.target.value.trim();
    setState({
      ...state,
      interval,
      isValid: isValid(interval),
    });
  };

  const onChangePatternsDisabled = (event: ChangeEvent<HTMLInputElement>) => {
    const patternsDisabled = event.currentTarget.checked;
    setState({
      ...state,
      patternsDisabled,
    });
  };

  const onChangeDefaultTimeRangeEnabled = (event: ChangeEvent<HTMLInputElement>) => {
    const defaultTimeRangeEnabled = event.currentTarget.checked;
    setState({
      ...state,
      defaultTimeRangeEnabled,
    });
  };

  const onChangeDefaultTimeRangeFrom = (event: ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      defaultTimeRangeFrom: event.target.value.trim(),
    });
  };

  const onChangeDefaultTimeRangeTo = (event: ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      defaultTimeRangeTo: event.target.value.trim(),
    });
  };

  const defaultTimeRangeValidation = state.defaultTimeRangeEnabled
    ? validateDefaultTimeRange(state.defaultTimeRangeFrom, state.defaultTimeRangeTo)
    : null;
  const isDefaultTimeRangeValid =
    !state.defaultTimeRangeEnabled || (defaultTimeRangeValidation !== null && defaultTimeRangeValidation.valid);

  return (
    <div data-testid={testIds.appConfig.container}>
      <FieldSet label={t('components.app-config.label-settings', 'Settings')}>
        <Field
          description={
            <span>
              <Trans i18nKey="components.app-config.default-data-source-description">
                The default data source to be used for new Logs Drilldown users. Each user can override their default by
                setting another data source in Logs Drilldown.
              </Trans>
            </span>
          }
          label={t('components.app-config.label-default-data-source', 'Default data source')}
        >
          <DataSourcePicker
            width={60}
            filter={(ds) => ds.type === 'loki'}
            current={state.dataSource}
            onChange={onChangeDatasource}
          />
        </Field>

        <Field
          className={styles.marginTop}
          description={
            <span>
              <Trans i18nKey="components.app-config.default-time-range-description">
                When enabled, this time range is used when users open Logs Drilldown for the first time, and without a
                time range in the URL. When disabled, the app uses its built-in default (last 15 minutes).
              </Trans>
            </span>
          }
          label={t('components.app-config.label-default-time-range', 'Default time range')}
        >
          <Checkbox
            id="default-time-range-enabled"
            data-testid={testIds.appConfig.defaultTimeRangeEnabled}
            label={t(
              'components.app-config.default-time-range-enabled-label-use-custom-default-time-range',
              'Use custom default time range'
            )}
            value={state.defaultTimeRangeEnabled}
            onChange={onChangeDefaultTimeRangeEnabled}
          />
        </Field>

        {state.defaultTimeRangeEnabled && (
          <div className={styles.defaultTimeRangeInputs}>
            <Field
              invalid={defaultTimeRangeValidation !== null && !defaultTimeRangeValidation.valid}
              error={
                defaultTimeRangeValidation !== null && !defaultTimeRangeValidation.valid
                  ? defaultTimeRangeValidation.error
                  : undefined
              }
              description={t(
                'components.app-config.description-start-range',
                'Start of the range (e.g. now-15m, now-1h, now-24h)'
              )}
              label={t('components.app-config.label-from', 'From')}
            >
              <Input
                width={40}
                id="default-time-range-from"
                data-testid={testIds.appConfig.defaultTimeRangeFrom}
                value={state.defaultTimeRangeFrom}
                placeholder={t('components.app-config.default-time-range-from-placeholder-now-15m', 'now-15m')}
                onChange={onChangeDefaultTimeRangeFrom}
              />
            </Field>
            <Field
              className={styles.marginTop}
              invalid={defaultTimeRangeValidation !== null && !defaultTimeRangeValidation.valid}
              error={
                defaultTimeRangeValidation !== null && !defaultTimeRangeValidation.valid
                  ? defaultTimeRangeValidation.error
                  : undefined
              }
              description={t(
                'components.app-config.description-end-of-the-range-eg-now',
                'End of the range (e.g. now)'
              )}
              label={t('components.app-config.label-to', 'To')}
            >
              <Input
                width={40}
                id="default-time-range-to"
                data-testid={testIds.appConfig.defaultTimeRangeTo}
                value={state.defaultTimeRangeTo}
                placeholder={t('components.app-config.default-time-range-to-placeholder-now', 'now')}
                onChange={onChangeDefaultTimeRangeTo}
              />
            </Field>
          </div>
        )}

        <Field
          invalid={!isValid(state.interval)}
          error={t(
            'components.app-config.interval-invalid-error',
            'Interval is invalid. Please enter an interval longer than "60m". For example: 3d, 1w, 1m'
          )}
          description={
            <span>
              <Trans i18nKey="components.app-config.max-interval-description">
                The maximum interval that can be selected in the time picker within the Grafana Logs Drilldown app. If
                empty, users can select any time range interval in Grafana Logs Drilldown. <br />
                Example values: 7d, 24h, 2w
              </Trans>
            </span>
          }
          label={t('components.app-config.label-maximum-time-picker-interval', 'Maximum time picker interval')}
          className={styles.marginTop}
        >
          <Input
            width={60}
            id="interval"
            data-testid={testIds.appConfig.interval}
            label={t('components.app-config.label-max-interval', 'Max interval')}
            value={state?.interval}
            placeholder={t('components.app-config.interval-placeholder', '7d')}
            onChange={onChangeInterval}
          />
        </Field>

        <Field
          className={styles.marginTop}
          description={
            <span>
              <Trans i18nKey="components.app-config.disable-patterns-description">
                Disables Logs Drilldown&apos;s usage of the{' '}
                <a
                  className="external-link"
                  href="https://grafana.com/docs/loki/latest/reference/loki-http-api/#patterns-detection"
                  target="_blank"
                  rel="noreferrer"
                >
                  Loki Patterns API
                </a>{' '}
                endpoint, and removes the Patterns tab.
              </Trans>
            </span>
          }
          label={t('components.app-config.label-disable-loki-patterns', 'Disable Loki patterns')}
        >
          <Checkbox
            id="disable-patterns"
            data-testid={testIds.appConfig.interval}
            label={t('components.app-config.label-disable-patterns', 'Disable patterns')}
            value={state?.patternsDisabled}
            placeholder={t('components.app-config.patterns-placeholder', '7d')}
            onChange={onChangePatternsDisabled}
          />
        </Field>

        <div className={styles.marginTop}>
          <Button
            type="submit"
            data-testid={testIds.appConfig.submit}
            onClick={() =>
              updatePluginAndReload(plugin.meta.id, {
                enabled,
                jsonData: {
                  dataSource: state.dataSource,
                  interval: state.interval,
                  patternsDisabled: state.patternsDisabled,
                  defaultTimeRange:
                    state.defaultTimeRangeEnabled &&
                    state.defaultTimeRangeFrom.trim() &&
                    state.defaultTimeRangeTo.trim()
                      ? { from: state.defaultTimeRangeFrom.trim(), to: state.defaultTimeRangeTo.trim() }
                      : undefined,
                },
                pinned,
              })
            }
            disabled={!isValid(state.interval) || !isDefaultTimeRangeValid}
          >
            <Trans i18nKey="components.app-config.save-settings">Save settings</Trans>
          </Button>
        </div>
        <div className={styles.note}>
          <Alert severity="info" title="">
            <Trans i18nKey="components.app-config.active-users-reload-reflect-configuration-changes">
              Active users must reload the app to reflect configuration changes.
            </Trans>
          </Alert>
        </div>
      </FieldSet>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  colorWeak: css`
    color: ${theme.colors.text.secondary};
  `,
  icon: css({
    marginLeft: theme.spacing(1),
  }),
  label: css({
    alignItems: 'center',
    display: 'flex',
    marginBottom: theme.spacing(0.75),
  }),
  defaultTimeRangeInputs: css({
    marginTop: theme.spacing(2),
  }),
  marginTop: css`
    margin-top: ${theme.spacing(3)};
  `,
  marginTopXl: css`
    margin-top: ${theme.spacing(6)};
  `,
  note: css({
    marginTop: theme.spacing(2),
  }),
});

const updatePluginAndReload = async (pluginId: string, data: Partial<PluginMeta<JsonData>>) => {
  try {
    await updatePlugin(pluginId, data);

    // Reloading the page as the changes made here wouldn't be propagated to the actual plugin otherwise.
    // This is not ideal, however unfortunately currently there is no supported way for updating the plugin state.
    locationService.reload();
  } catch (e) {
    logger.error(e, { msg: 'Error while updating the plugin' });
  }
};

const testIds = {
  appConfig: {
    container: 'data-testid ac-container',
    datasource: 'data-testid ac-datasource-input',
    interval: 'data-testid ac-interval-input',
    pattern: 'data-testid ac-patterns-disabled',
    submit: 'data-testid ac-submit-form',
    defaultTimeRangeEnabled: 'data-testid ac-default-time-range-enabled',
    defaultTimeRangeFrom: 'data-testid ac-default-time-range-from',
    defaultTimeRangeTo: 'data-testid ac-default-time-range-to',
  },
};

export const updatePlugin = async (pluginId: string, data: Partial<PluginMeta>) => {
  const response = getBackendSrv().fetch({
    data,
    method: 'POST',
    url: `/api/plugins/${pluginId}/settings`,
  });

  const dataResponse = await lastValueFrom(response);

  return dataResponse.data;
};

const isValid = (interval: string): boolean => {
  try {
    if (interval) {
      const seconds = rangeUtil.intervalToSeconds(interval);
      return isNumber(seconds) && seconds >= MIN_INTERVAL_SECONDS;
    } else {
      // Empty strings are fine
      return true;
    }
  } catch (e) {}

  return false;
};

export default AppConfig;
