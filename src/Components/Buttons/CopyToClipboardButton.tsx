import React, { useEffect, useRef } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, InlineToast, useStyles2 } from '@grafana/ui';

const SHOW_SUCCESS_DURATION = 2 * 1000;

export default function CopyToClipboardButton({
  onClick,
  stopPropagation = true,
}: {
  onClick: () => void;
  stopPropagation?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const copiedText = t('clipboard-button.inline-toast.success', 'Copied');
  const defaultText = t('logs.log-line-details.copy-to-clipboard', 'Copy to clipboard');
  const buttonRef = useRef<null | HTMLButtonElement>(null);
  const styles = useStyles2(getStyles);

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
        className={styles}
        aria-pressed={copied}
        tooltip={copied ? '' : defaultText}
        tooltipPlacement="top"
        size="md"
        name="copy"
        ref={buttonRef}
        onClick={(e) => {
          if (stopPropagation) {
            // If the user clicked on the button, don't trigger the node to expand/collapse
            e.stopPropagation();
          }
          onClick();
          setCopied(true);
        }}
        tabIndex={0}
      />
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return css({
    color: theme.colors.text.secondary,
  });
};
