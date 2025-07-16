import React from 'react';

import { LinkButton } from '@grafana/ui';

import { narrowJsonDerivedFieldLinkPayload } from '../../../services/narrowing';

function JsonLinkButton({ payload }: { payload: string }) {
  const decodedPayload = JSON.parse(payload);
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

export default JsonLinkButton;
