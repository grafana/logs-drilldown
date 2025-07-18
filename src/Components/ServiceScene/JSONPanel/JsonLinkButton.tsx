import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';

import { logger } from '../../../services/logger';
import { narrowJsonDerivedFieldLinkPayload } from '../../../services/narrowing';

function JsonLinkButton({ payload }: { payload: string }) {
  const styles = useStyles2(getStyles);
  let decodedPayload;
  try {
    decodedPayload = JSON.parse(payload);
  } catch (e) {
    logger.error(e, { msg: 'Unable to parse JsonLinkButton payload!' });
  }

  const decodedPayloadNarrowed = narrowJsonDerivedFieldLinkPayload(decodedPayload);
  if (decodedPayloadNarrowed) {
    return (
      <LinkButton
        className={styles.button}
        icon={'external-link-alt'}
        variant={'secondary'}
        size={'sm'}
        fill={'text'}
        href={decodedPayloadNarrowed.href}
        target={'_blank'}
      >
        {decodedPayloadNarrowed.name}
      </LinkButton>
    );
  }

  return null;
}
const getStyles = (theme: GrafanaTheme2) => {
  return {
    button: css({
      '&:hover': {
        color: theme.colors.primary.text,
      },
    }),
  };
};

export default JsonLinkButton;
