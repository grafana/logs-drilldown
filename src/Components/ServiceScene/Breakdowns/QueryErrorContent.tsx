import React from 'react';

import { css } from '@emotion/css';

import { DataQueryError, GrafanaTheme2 } from '@grafana/data';
import { Alert, useStyles2 } from '@grafana/ui';

import { GrotError } from '../../GrotError';

export function QueryErrorAlert(props: { errors?: DataQueryError[]; tagKey: string }) {
  const styles = useStyles2(getQueryErrorStyles);
  return (
    <GrotError>
      <div className={styles.queryError}>
        <Alert title={`Error fetching results for ${props.tagKey}`} severity={'error'}>
          {props.errors?.map((err, index) => (
            <QueryErrorContent key={index} err={err} label={props.tagKey} />
          ))}
        </Alert>
      </div>
    </GrotError>
  );
}

export function QueryErrorContent(props: { err: DataQueryError; label: string }) {
  return (
    <div>
      {props.err.traceId && (
        <div>
          <strong>TraceId</strong>: {props.err.traceId}
        </div>
      )}
      <ErrorMessage err={props.err} label={props.label} />
    </div>
  );
}

function ErrorMessage(props: { err: DataQueryError; label: string }) {
  if (props.err.message?.match(/maximum of series \(\d+\) reached for a single query/)) {
    return (
      <>
        {props.err.message && (
          <>
            <p>
              <strong>Max series limit exceeded</strong>: {props.err.message}.
            </p>
            <p>
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
            </p>
            <p>
              <strong>Workaround:</strong> Reduce the time range, or add additional filters to reduce the number of
              unique values in the {props.label} field.
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
          <strong>Message</strong>: {props.err.message}
        </div>
      )}
    </>
  );
}

export const getQueryErrorStyles = (theme: GrafanaTheme2) => {
  return {
    queryError: css({
      textAlign: 'left',
    }),
  };
};
