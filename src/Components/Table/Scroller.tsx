import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useTheme2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  scroller: css`
    position: absolute;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 20px;
    top: 32px;
    margin-top: -24px;
    // For some reason clicking on this button causes text to be selected in the following row
    user-select: none;
  `,
  scrollLeft: css`
    cursor: pointer;
    background: ${theme.colors.background.primary};

    &:hover {
      background: ${theme.colors.background.secondary};
    }
  `,
  scrollRight: css`
    cursor: pointer;
    background: ${theme.colors.background.primary};

    &:hover {
      background: ${theme.colors.background.secondary};
    }
  `,
});

const stopScroll = (id: React.MutableRefObject<HTMLDivElement | null>) => {
  id?.current?.scrollTo({
    left: id.current?.scrollLeft,
  });
};

const goLeft = (id: React.MutableRefObject<HTMLDivElement | null>) => {
  id?.current?.scrollTo({
    behavior: 'smooth',
    left: 0,
    top: 0,
  });
};

const goRight = (id: React.MutableRefObject<HTMLDivElement | null>) => {
  id?.current?.scrollTo({
    behavior: 'smooth',
    left: id.current.scrollWidth,
    top: 0,
  });
};

export function Scroller({ scrollerRef: ref }: { scrollerRef: React.MutableRefObject<HTMLDivElement | null> }) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return (
    <div className={styles.scroller}>
      <span onPointerDown={() => goLeft(ref)} onPointerUp={() => stopScroll(ref)} className={styles.scrollLeft}>
        <Icon name={'arrow-left'} />
      </span>
      <span onPointerDown={() => goRight(ref)} onPointerUp={() => stopScroll(ref)} className={styles.scrollRight}>
        <Icon name={'arrow-right'} />
      </span>
    </div>
  );
}
