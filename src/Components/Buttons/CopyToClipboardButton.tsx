import React, { useEffect, useRef } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { InlineToast, useStyles2 } from '@grafana/ui';

import ImgButton from '../UI/ImgButton';

const SHOW_SUCCESS_DURATION = 2 * 1000;
const COPY_TO_CLIPBOARD_TEXT = t('logs.log-line-details.copy-to-clipboard', 'Copy to clipboard');
const COPY_LINK_TO_LINE_TEXT = t('logs.log-line-menu.copy-link', 'Copy link to log line');
const COPY_LINK_ERROR_TEXT = t('logs.log-line-details.copy-to-clipboard-error', 'Error copying link!');
const COPY_SUCCESS = t('clipboard-button.inline-toast.success', 'Copied');

export default function CopyToClipboardButton({
  onClick,
  stopPropagation = true,
  type = 'copy',
}: {
  onClick: () => void;
  stopPropagation?: boolean;
  type?: 'copy' | 'share-alt';
}) {
  const defaultText = type === 'copy' ? COPY_TO_CLIPBOARD_TEXT : COPY_LINK_TO_LINE_TEXT;
  const [copied, setCopied] = React.useState(false);
  const [copiedText, setCopiedText] = React.useState(COPY_SUCCESS);
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
      <ImgButton
        className={styles}
        aria-pressed={copied}
        tooltip={copied ? '' : defaultText}
        name={type}
        ref={buttonRef}
        onClick={(e) => {
          if (stopPropagation) {
            // If the user clicked on the button, don't trigger the node to expand/collapse
            e.stopPropagation();
          }
          try {
            onClick();
            setCopiedText(COPY_SUCCESS);
          } catch (e) {
            setCopiedText(COPY_LINK_ERROR_TEXT);
          }
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
