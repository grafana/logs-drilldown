import React from 'react';

import { css } from '@emotion/css';

import { DataQueryError, GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, EmptyState, LinkButton, useStyles2 } from '@grafana/ui';

import { PageSlugs } from '../../../services/enums';
import { getDrillDownTabLink } from '../../../services/navigate';
import { ServiceScene } from '../ServiceScene';

export const MaxSeriesRegex = /maximum of series \(\d+\) reached for a single query/;

export function QueryErrorAlert(props: {
  errors?: DataQueryError[];
  isPartial: boolean;
  serviceScene: ServiceScene;
  tagKey: string;
}) {
  const styles = useStyles2(getQueryErrorStyles);
  const errorSet = new Set<string>();
  const traceSet = new Set<string>();
  const errors = props.errors?.filter((err) => {
    if (err.traceId) {
      traceSet.add(err.traceId);
    }
    if (err.message) {
      if (errorSet.has(err.message)) {
        return false;
      }
      errorSet.add(err.message);
    }
    return true;
  });

  const title = props.isPartial
    ? t('components.logs.logs-drilldown.query-error.partial', 'Showing partial results for {{tagKey}}', {
        tagKey: props.tagKey,
      })
    : t('components.logs.logs-drilldown.query-error.fetch', 'Error fetching results for {{tagKey}}', {
        tagKey: props.tagKey,
      });

  return (
    <EmptyState variant="not-found" message={title}>
      <div className={styles.queryError}>
        <Alert title={title} severity={'error'}>
          {errors?.map((err, index) => (
            <QueryErrorContent traces={traceSet} key={index} err={err} label={props.tagKey} />
          ))}
          <div className={styles.buttonWrap}>
            <LinkButton variant={'secondary'} href={getDrillDownTabLink(PageSlugs.fields, props.serviceScene)}>
              {t('components.logs.logs-drilldown.query-error.return-fields', 'Return to all fields')}
            </LinkButton>
          </div>
        </Alert>
      </div>
    </EmptyState>
  );
}

export function QueryErrorContent(props: { err: DataQueryError; label: string; traces: Set<string> }) {
  const traces = [...props.traces];
  return (
    <div>
      {traces.length && (
        <div>
          {traces.length === 1 && (
            <>
              <strong>
                <Trans i18nKey="components.query-error-content.trace-id">TraceId</Trans>
              </strong>
              : {traces[0]}
            </>
          )}
          {traces.length > 1 && (
            <>
              <strong>
                <Trans i18nKey="components.query-error-content.trace-ids">TraceIds</Trans>
              </strong>
              : {traces.join(', ')}
            </>
          )}
        </div>
      )}
      <ErrorMessage err={props.err} label={props.label} />
    </div>
  );
}

function ErrorMessage(props: { err: DataQueryError; label: string }) {
  if (props.err.message?.match(MaxSeriesRegex)) {
    return (
      <>
        {props.err.message && (
          <>
            <p>
              <strong>
                <Trans i18nKey="components.error-message.max-series-limit-exceeded">Max series limit exceeded</Trans>
              </strong>
              : {props.err.message}.
            </p>
            <p>
              <Trans i18nKey="components.error-message.increase-limit">
                To increase this limit, adjust the{' '}
                <a
                  target={'_blank'}
                  href="https://grafana.com/docs/loki/latest/configure/#limits_config"
                  className="external-link"
                  rel="noreferrer"
                >
                  max_query_series
                </a>{' '}
                in your Loki configuration.
              </Trans>
            </p>
            <p>
              <Trans i18nKey="components.error-message.tip-reduce-range" values={{ label: props.label }}>
                <strong>Tip:</strong> Reduce the time range, or add additional filters to reduce the number of unique
                values in the {'{{label}}'} field.
              </Trans>
            </p>
          </>
        )}
      </>
    );
  }

  return (
    <>
      {props.err.message && (
        <div>
          <strong>
            <Trans i18nKey="components.error-message.message">Message</Trans>
          </strong>
          : {props.err.message}
        </div>
      )}
    </>
  );
}

export const getQueryErrorStyles = (theme: GrafanaTheme2) => {
  return {
    buttonWrap: css({
      display: 'flex',
      justifyContent: 'flex-end',
    }),
    queryError: css({
      textAlign: 'left',
    }),
  };
};
