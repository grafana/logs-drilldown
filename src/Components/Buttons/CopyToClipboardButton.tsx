import React, { useEffect, useRef } from 'react';

import { t } from '@grafana/i18n';
import { IconButton, InlineToast } from '@grafana/ui';

const SHOW_SUCCESS_DURATION = 2 * 1000;

export default function CopyToClipboardButton(props: { onClick: () => void }) {
  const [copied, setCopied] = React.useState(false);
  const copiedText = t('clipboard-button.inline-toast.success', 'Copied');
  const defaultText = t('logs.log-line-details.copy-to-clipboard', 'Copy to clipboard');
  const buttonRef = useRef<null | HTMLButtonElement>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (copied) {
      timeoutId = setTimeout(() => {
        setCopied(false);
      }, SHOW_SUCCESS_DURATION);
    }

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  return (
    <>
      {copied && (
        <InlineToast placement="top" referenceElement={buttonRef.current}>
          {copiedText}
        </InlineToast>
      )}
      <IconButton
        aria-pressed={copied}
        tooltip={copied ? '' : defaultText}
        tooltipPlacement="top"
        size="md"
        name="copy"
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          props.onClick();
          setCopied(true);
        }}
        tabIndex={0}
      />
    </>
  );
}
