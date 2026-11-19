import React, { ChangeEvent, useEffect, useState } from 'react';

import { css } from '@emotion/css';
import { isNumber } from 'lodash';

import {
  AppPluginMeta,
  DataSourceInstanceSettings,
  getTimeZone,
  GrafanaTheme2,
  LogsSortOrder,
  PluginConfigPageProps,
  PluginMeta,
  rangeUtil,
} from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { updateAppPluginSettings } from '@grafana/plugin-compat/apps';
import { DataSourcePicker, locationService } from '@grafana/runtime';
import { Box, Button, Checkbox, Field, FieldSet, Input, RadioButtonGroup, Text, useStyles2 } from '@grafana/ui';

import { FeatureFlagContext } from 'Components/FeatureFlagContext';
import { useDefaultDatasourceUid } from 'services/initialDatasourceInfo';
import { logger } from 'services/logger';
import { getLastUsedDataSourceFromStorage, type LogsVisualizationType } from 'services/store';
import { testIds } from 'services/testIds';
import { isValidTimeRange } from 'services/utils';

export type JsonData = {
  dataSource?: string;
  defaultDetailsMode?: 'inline' | 'sidebar';
  defaultFontSize?: 'default' | 'small';
  defaultJSONSortOrder?: LogsSortOrder;
  defaultJSONSyntaxHighlighting?: boolean;
  defaultJSONWrapLogMessage?: boolean;
  defaultPrettifyLogMessage?: boolean;
  defaultShowTime?: boolean;
  defaultSortOrder?: LogsSortOrder;
  defaultSyntaxHighlighting?: boolean;
  defaultTableSortOrder?: LogsSortOrder;
  defaultTableWrapText?: boolean;
  /** When set, used as the initial time range when opening the app (if URL has no from/to). */
  defaultTimeRange?: { from: string; to: string };
  defaultTimestampResolution?: 'ms' | 'ns';
  defaultUnwrappedColumns?: boolean;
  defaultVisualizationType?: LogsVisualizationType;
  defaultWrapLogMessage?: boolean;
  interval?: string;
  patternsDisabled?: boolean;
};

type State = {
  dataSource: string;
  defaultDetailsMode: 'inline' | 'sidebar';
  defaultFontSize: 'default' | 'small';
  defaultJSONSortOrder: LogsSortOrder;
  defaultJSONSyntaxHighlighting: boolean;
  defaultJSONWrapLogMessage: boolean;
  defaultPrettifyLogMessage: boolean;
  defaultShowTime: boolean;
  defaultSortOrder: LogsSortOrder;
  defaultSyntaxHighlighting: boolean;
  defaultTableSortOrder: LogsSortOrder;
  defaultTableWrapText: boolean;
  defaultTimeRangeEnabled: boolean;
  defaultTimeRangeFrom: string;
  defaultTimeRangeTo: string;
  defaultTimestampResolution: 'ms' | 'ns';
  defaultUnwrappedColumns: boolean;
  defaultVisualizationType: LogsVisualizationType;
  defaultWrapLogMessage: boolean;
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
    dataSource: jsonData?.dataSource ?? '',
    interval: jsonData?.interval ?? '',
    isValid: isValid(jsonData?.interval ?? ''),
    patternsDisabled: jsonData?.patternsDisabled ?? false,
    defaultTimeRangeEnabled: hasDefaultTimeRange,
    defaultTimeRangeFrom: jsonData?.defaultTimeRange?.from ?? 'now-15m',
    defaultTimeRangeTo: jsonData?.defaultTimeRange?.to ?? 'now',
    defaultVisualizationType: jsonData?.defaultVisualizationType ?? 'logs',
    defaultWrapLogMessage: jsonData?.defaultWrapLogMessage ?? false,
    defaultPrettifyLogMessage: jsonData?.defaultPrettifyLogMessage ?? false,
    defaultUnwrappedColumns: jsonData?.defaultUnwrappedColumns ?? false,
    defaultShowTime: jsonData?.defaultShowTime ?? true,
    defaultTimestampResolution: jsonData?.defaultTimestampResolution ?? 'ms',
    defaultFontSize: jsonData?.defaultFontSize ?? 'default',
    defaultSortOrder: jsonData?.defaultSortOrder ?? LogsSortOrder.Descending,
    defaultDetailsMode: jsonData?.defaultDetailsMode ?? 'inline',
    defaultSyntaxHighlighting: jsonData?.defaultSyntaxHighlighting ?? true,
    defaultTableWrapText: jsonData?.defaultTableWrapText ?? true,
    defaultTableSortOrder: jsonData?.defaultTableSortOrder ?? LogsSortOrder.Descending,
    defaultJSONSortOrder: jsonData?.defaultJSONSortOrder ?? LogsSortOrder.Descending,
    defaultJSONWrapLogMessage: jsonData?.defaultJSONWrapLogMessage ?? true,
    defaultJSONSyntaxHighlighting: jsonData?.defaultJSONSyntaxHighlighting ?? false,
  });
  const { dsUID: defaultUid, isLoading } = useDefaultDatasourceUid(jsonData?.dataSource);
  const isResolvingDefault = isLoading && !state.dataSource;

  useEffect(() => {
    const dataSource = defaultUid ?? getLastUsedDataSourceFromStorage();
    if (!isLoading && dataSource) {
      setState((prev) => (prev.dataSource ? prev : { ...prev, dataSource }));
    }
  }, [defaultUid, isLoading]);

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
    <FeatureFlagContext>
      <div data-testid={testIds.appConfig.container}>
        <FieldSet label={t('components.app-config.label-settings', 'Settings')}>
          <Field
            description={
              <span>
                <Trans i18nKey="components.app-config.default-data-source-description">
                  The default data source to be used for new Logs Drilldown users. Each user can override their default
                  by setting another data source in Logs Drilldown.
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

          <Field
            label={t('components.app-config.visualization.title', 'Default visualization')}
            description={t(
              'components.app-config.visualization.description',
              'Choose the initial visualization for your organization. URL settings and browser preferences take precedence.'
            )}
          >
            <RadioButtonGroup<LogsVisualizationType>
              aria-label={t('components.app-config.visualization.type', 'Default visualization')}
              data-testid={testIds.appConfig.defaultVisualizationType}
              options={[
                { label: t('components.app-config.visualization.logs', 'Logs'), value: 'logs' },
                { label: t('components.app-config.visualization.table', 'Table'), value: 'table' },
                { label: t('components.app-config.visualization.json', 'JSON'), value: 'json' },
              ]}
              value={state.defaultVisualizationType}
              size="sm"
              onChange={(defaultVisualizationType) => setState({ ...state, defaultVisualizationType })}
            />
          </Field>

          <Box
            backgroundColor="primary"
            borderColor="weak"
            borderStyle="solid"
            borderRadius="default"
            marginBottom={4}
            padding={2}
          >
            <FieldSet label={<Text element="h5">{t('components.app-config.logs-panel.title', 'Logs panel')}</Text>}>
              <Field label={t('components.app-config.logs-panel.wrapping', 'Line wrapping')}>
                <RadioButtonGroup
                  aria-label={t('components.app-config.logs-panel.wrapping', 'Line wrapping')}
                  data-testid={testIds.appConfig.logsPanel.wrapping}
                  options={[
                    { label: t('components.app-config.logs-panel.wrapping-disabled', 'Disabled'), value: 'off' },
                    { label: t('components.app-config.logs-panel.wrapping-enabled', 'Enabled'), value: 'on' },
                    {
                      label: t('components.app-config.logs-panel.wrapping-json', 'Enabled with JSON formatting'),
                      value: 'json',
                    },
                  ]}
                  value={!state.defaultWrapLogMessage ? 'off' : state.defaultPrettifyLogMessage ? 'json' : 'on'}
                  size="sm"
                  onChange={(wrapping) =>
                    setState({
                      ...state,
                      defaultWrapLogMessage: wrapping !== 'off',
                      defaultPrettifyLogMessage: wrapping === 'json',
                    })
                  }
                />
              </Field>
              {!state.defaultWrapLogMessage && (
                <Field
                  label={t('components.app-config.logs-panel.columns', 'Columns for unwrapped fields')}
                  description={t(
                    'components.app-config.logs-panel.columns-description',
                    'Align displayed fields in columns when line wrapping is disabled.'
                  )}
                >
                  <RadioButtonGroup<boolean>
                    aria-label={t('components.app-config.logs-panel.columns', 'Columns for unwrapped fields')}
                    data-testid={testIds.appConfig.logsPanel.columns}
                    options={[
                      { label: t('components.app-config.logs-panel.enabled', 'Enabled'), value: true },
                      { label: t('components.app-config.logs-panel.disabled', 'Disabled'), value: false },
                    ]}
                    value={state.defaultUnwrappedColumns}
                    size="sm"
                    onChange={(defaultUnwrappedColumns) => setState({ ...state, defaultUnwrappedColumns })}
                  />
                </Field>
              )}
              <Field label={t('components.app-config.logs-panel.timestamps', 'Timestamps')}>
                <RadioButtonGroup<'ms' | 'ns' | 'off'>
                  aria-label={t('components.app-config.logs-panel.timestamps', 'Timestamps')}
                  data-testid={testIds.appConfig.logsPanel.timestamps}
                  options={[
                    { label: t('components.app-config.logs-panel.disabled', 'Disabled'), value: 'off' },
                    { label: t('components.app-config.logs-panel.milliseconds', 'Milliseconds'), value: 'ms' },
                    { label: t('components.app-config.logs-panel.nanoseconds', 'Nanoseconds'), value: 'ns' },
                  ]}
                  value={state.defaultShowTime ? state.defaultTimestampResolution : 'off'}
                  size="sm"
                  onChange={(resolution) =>
                    setState({
                      ...state,
                      defaultShowTime: resolution !== 'off',
                      defaultTimestampResolution: resolution === 'off' ? state.defaultTimestampResolution : resolution,
                    })
                  }
                />
              </Field>
              <Field label={t('components.app-config.logs-panel.font-size', 'Font size')}>
                <RadioButtonGroup<State['defaultFontSize']>
                  aria-label={t('components.app-config.logs-panel.font-size', 'Font size')}
                  data-testid={testIds.appConfig.logsPanel.fontSize}
                  options={[
                    { label: t('components.app-config.logs-panel.font-default', 'Default'), value: 'default' },
                    { label: t('components.app-config.logs-panel.font-small', 'Small'), value: 'small' },
                  ]}
                  value={state.defaultFontSize}
                  size="sm"
                  onChange={(defaultFontSize) => setState({ ...state, defaultFontSize })}
                />
              </Field>
              <Field label={t('components.app-config.visualization.sort-order', 'Sort order')}>
                <RadioButtonGroup
                  aria-label={t('components.app-config.visualization.sort-order', 'Sort order')}
                  data-testid={testIds.appConfig.logsPanel.sortOrder}
                  options={[
                    {
                      label: t('components.app-config.visualization.newest-first', 'Newest first'),
                      value: LogsSortOrder.Descending,
                    },
                    {
                      label: t('components.app-config.visualization.oldest-first', 'Oldest first'),
                      value: LogsSortOrder.Ascending,
                    },
                  ]}
                  value={state.defaultSortOrder}
                  size="sm"
                  onChange={(defaultSortOrder) => setState({ ...state, defaultSortOrder })}
                />
              </Field>
              <Field label={t('components.app-config.logs-panel.details-mode', 'Details mode')}>
                <RadioButtonGroup<State['defaultDetailsMode']>
                  aria-label={t('components.app-config.logs-panel.details-mode', 'Details mode')}
                  data-testid={testIds.appConfig.logsPanel.detailsMode}
                  options={[
                    { label: t('components.app-config.logs-panel.details-inline', 'Inline'), value: 'inline' },
                    { label: t('components.app-config.logs-panel.details-sidebar', 'Sidebar'), value: 'sidebar' },
                  ]}
                  value={state.defaultDetailsMode}
                  size="sm"
                  onChange={(defaultDetailsMode) => setState({ ...state, defaultDetailsMode })}
                />
              </Field>
              <Field label={t('components.app-config.visualization.syntax-highlighting', 'Syntax highlighting')}>
                <RadioButtonGroup<boolean>
                  aria-label={t('components.app-config.visualization.syntax-highlighting', 'Syntax highlighting')}
                  data-testid={testIds.appConfig.logsPanel.syntaxHighlighting}
                  options={[
                    { label: t('components.app-config.logs-panel.enabled', 'Enabled'), value: true },
                    { label: t('components.app-config.logs-panel.disabled', 'Disabled'), value: false },
                  ]}
                  value={state.defaultSyntaxHighlighting}
                  size="sm"
                  onChange={(defaultSyntaxHighlighting) => setState({ ...state, defaultSyntaxHighlighting })}
                />
              </Field>
            </FieldSet>
          </Box>

          <Box
            backgroundColor="primary"
            borderColor="weak"
            borderStyle="solid"
            borderRadius="default"
            marginBottom={4}
            padding={2}
          >
            <FieldSet label={<Text element="h5">{t('components.app-config.table-panel.title', 'Table panel')}</Text>}>
              <Field label={t('components.app-config.logs-panel.wrapping', 'Line wrapping')}>
                <RadioButtonGroup<boolean>
                  aria-label={t('components.app-config.logs-panel.wrapping', 'Line wrapping')}
                  data-testid={testIds.appConfig.tablePanel.wrapping}
                  options={[
                    { label: t('components.app-config.logs-panel.enabled', 'Enabled'), value: true },
                    { label: t('components.app-config.logs-panel.disabled', 'Disabled'), value: false },
                  ]}
                  value={state.defaultTableWrapText}
                  size="sm"
                  onChange={(defaultTableWrapText) => setState({ ...state, defaultTableWrapText })}
                />
              </Field>
              <Field label={t('components.app-config.visualization.sort-order', 'Sort order')}>
                <RadioButtonGroup
                  aria-label={t('components.app-config.visualization.sort-order', 'Sort order')}
                  data-testid={testIds.appConfig.tablePanel.sortOrder}
                  options={[
                    {
                      label: t('components.app-config.visualization.newest-first', 'Newest first'),
                      value: LogsSortOrder.Descending,
                    },
                    {
                      label: t('components.app-config.visualization.oldest-first', 'Oldest first'),
                      value: LogsSortOrder.Ascending,
                    },
                  ]}
                  value={state.defaultTableSortOrder}
                  size="sm"
                  onChange={(defaultTableSortOrder) => setState({ ...state, defaultTableSortOrder })}
                />
              </Field>
            </FieldSet>
          </Box>

          <Box
            backgroundColor="primary"
            borderColor="weak"
            borderStyle="solid"
            borderRadius="default"
            marginBottom={4}
            padding={2}
          >
            <FieldSet label={<Text element="h5">{t('components.app-config.json-panel.title', 'JSON panel')}</Text>}>
              <Field label={t('components.app-config.visualization.sort-order', 'Sort order')}>
                <RadioButtonGroup
                  aria-label={t('components.app-config.visualization.sort-order', 'Sort order')}
                  data-testid={testIds.appConfig.jsonPanel.sortOrder}
                  options={[
                    {
                      label: t('components.app-config.visualization.newest-first', 'Newest first'),
                      value: LogsSortOrder.Descending,
                    },
                    {
                      label: t('components.app-config.visualization.oldest-first', 'Oldest first'),
                      value: LogsSortOrder.Ascending,
                    },
                  ]}
                  value={state.defaultJSONSortOrder}
                  size="sm"
                  onChange={(defaultJSONSortOrder) => setState({ ...state, defaultJSONSortOrder })}
                />
              </Field>
              <Field label={t('components.app-config.logs-panel.wrapping', 'Line wrapping')}>
                <RadioButtonGroup<boolean>
                  aria-label={t('components.app-config.logs-panel.wrapping', 'Line wrapping')}
                  data-testid={testIds.appConfig.jsonPanel.wrapping}
                  options={[
                    { label: t('components.app-config.logs-panel.enabled', 'Enabled'), value: true },
                    { label: t('components.app-config.logs-panel.disabled', 'Disabled'), value: false },
                  ]}
                  value={state.defaultJSONWrapLogMessage}
                  size="sm"
                  onChange={(defaultJSONWrapLogMessage) => setState({ ...state, defaultJSONWrapLogMessage })}
                />
              </Field>
              <Field label={t('components.app-config.visualization.syntax-highlighting', 'Syntax highlighting')}>
                <RadioButtonGroup<boolean>
                  aria-label={t('components.app-config.visualization.syntax-highlighting', 'Syntax highlighting')}
                  data-testid={testIds.appConfig.jsonPanel.syntaxHighlighting}
                  options={[
                    { label: t('components.app-config.logs-panel.enabled', 'Enabled'), value: true },
                    { label: t('components.app-config.logs-panel.disabled', 'Disabled'), value: false },
                  ]}
                  value={state.defaultJSONSyntaxHighlighting}
                  size="sm"
                  onChange={(defaultJSONSyntaxHighlighting) => setState({ ...state, defaultJSONSyntaxHighlighting })}
                />
              </Field>
            </FieldSet>
          </Box>
        </FieldSet>
        <footer className={styles.footer}>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="components.app-config.active-users-reload-reflect-configuration-changes">
              Active users must reload the app to reflect configuration changes.
            </Trans>
          </Text>
          <Button
            type="submit"
            data-testid={testIds.appConfig.submit}
            onClick={() =>
              updatePluginAndReload(plugin.meta.id, {
                enabled,
                jsonData: {
                  defaultVisualizationType: state.defaultVisualizationType,
                  defaultWrapLogMessage: state.defaultWrapLogMessage,
                  defaultPrettifyLogMessage: state.defaultPrettifyLogMessage,
                  defaultUnwrappedColumns: state.defaultUnwrappedColumns,
                  defaultShowTime: state.defaultShowTime,
                  defaultTimestampResolution: state.defaultTimestampResolution,
                  defaultFontSize: state.defaultFontSize,
                  defaultSortOrder: state.defaultSortOrder,
                  defaultDetailsMode: state.defaultDetailsMode,
                  defaultSyntaxHighlighting: state.defaultSyntaxHighlighting,
                  defaultTableWrapText: state.defaultTableWrapText,
                  defaultTableSortOrder: state.defaultTableSortOrder,
                  defaultJSONSortOrder: state.defaultJSONSortOrder,
                  defaultJSONWrapLogMessage: state.defaultJSONWrapLogMessage,
                  defaultJSONSyntaxHighlighting: state.defaultJSONSyntaxHighlighting,
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
            disabled={isResolvingDefault || !isValid(state.interval) || !isDefaultTimeRangeValid}
          >
            <Trans i18nKey="components.app-config.save-settings">Save settings</Trans>
          </Button>
        </footer>
      </div>
    </FeatureFlagContext>
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
  footer: css({
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    bottom: 0,
    left: 0,
    background: theme.colors.background.secondary,
    zIndex: theme.zIndex.navbarFixed,
    padding: theme.spacing(1, 2),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.sm,
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

export const updatePlugin = async (pluginId: string, data: Partial<PluginMeta>) => {
  return updateAppPluginSettings(pluginId, data);
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
