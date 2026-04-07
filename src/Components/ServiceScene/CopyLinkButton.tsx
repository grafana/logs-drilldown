import React, { MouseEvent, useCallback, useEffect, useState } from 'react';

import { LogRowModel } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton } from '@grafana/ui';

interface Props {
  onClick(event: MouseEvent<HTMLElement>, row?: LogRowModel): void;
}

export const CopyLinkButton = ({ onClick }: Props) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (copied) {
      timeoutId = setTimeout(() => {
        setCopied(false);
      }, 2000);
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [copied]);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>, row?: LogRowModel) => {
      onClick(event, row);
      setCopied(true);
    },
    [onClick]
  );

  return (
    <IconButton
      aria-label={
        copied
          ? t('Components.copy-link-button.aria-label.copied', 'Copied')
          : t('Components.copy-link-button.aria-label.copy-link', 'Copy link to log line')
      }
      tooltip={
        copied
          ? t('Components.copy-link-button.tooltip.copied', 'Copied')
          : t('Components.copy-link-button.tooltip.copy-link', 'Copy link to log line')
      }
      tooltipPlacement="top"
      variant={copied ? 'primary' : 'secondary'}
      size="md"
      name={copied ? 'check' : 'share-alt'}
      onClick={handleClick}
    />
  );
};
