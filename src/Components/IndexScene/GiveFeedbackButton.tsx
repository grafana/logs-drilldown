import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';

export const GiveFeedbackButton = () => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <a
        href="https://forms.gle/1sYWCTPvD72T1dPH9"
        className={styles.feedback}
        title={t(
          'components.index-scene.give-feedback-button.title-share-thoughts-about-grafana',
          'Share your thoughts about Logs in Grafana.'
        )}
        target="_blank"
        rel="noreferrer noopener"
      >
        <Icon name="comment-alt-message" />{' '}
        <Trans i18nKey="components.index-scene.give-feedback-button.give-feedback">Give feedback</Trans>
      </a>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    feedback: css({
      '&:hover': {
        color: theme.colors.text.link,
      },
      alignSelf: 'center',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    wrapper: css({
      display: 'flex',
      gap: theme.spacing(1),
      marginLeft: 'auto',
      position: 'relative',
      top: theme.spacing(-1),
    }),
  };
};
