import React from 'react';

import { LinkButton } from '@grafana/ui';

import { logger } from 'services/logger';
import { narrowJsonDerivedFieldLinkPayload } from 'services/narrowing';

function JSONLinkNodeButton({ payload }: { payload: string }) {
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

export default JSONLinkNodeButton;
