import React from 'react';

import { LinkButton } from '@grafana/ui';

import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';

function JsonLinkButton(props: { href: string; keyPath: KeyPath }) {
  return (
    <LinkButton
      icon={'external-link-alt'}
      variant={'secondary'}
      size={'sm'}
      fill={'text'}
      href={props.href}
      target={'_blank'}
    >
      {props.keyPath[0]}
    </LinkButton>
  );
}
export default JsonLinkButton;
