import React, { useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Tag, useStyles2 } from '@grafana/ui';

import { testIds } from 'services/testIds';

interface Props {
  onRemove(): void;
  pattern: string;
  size?: PatternSize;
}

type PatternSize = 'lg' | 'sm';

export const PatternTag = ({ onRemove, pattern, size = 'lg' }: Props) => {
  const styles = useStyles2(getStyles);
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={styles.pattern}
      onClick={() => setExpanded(!expanded)}
      onMouseLeave={() => setExpanded(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          setExpanded(!expanded);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <Tag
        title={pattern}
        key={pattern}
        name={expanded ? pattern : getPatternPreview(pattern, size)}
        className={styles.tag}
      />
      <Button
        aria-label="Remove pattern"
        data-testid={testIds.exploreServiceDetails.buttonRemovePattern}
        variant="secondary"
        size="sm"
        className={styles.removeButton}
        onClick={onRemove}
      >
        <Icon name="times" />
      </Button>
    </div>
  );
};

const PREVIEW_WIDTH: Record<PatternSize, number> = {
  lg: Math.round(window.innerWidth / 8),
  sm: 50,
};

function getPatternPreview(pattern: string, size: PatternSize) {
  const length = pattern.length;
  if (length < PREVIEW_WIDTH[size]) {
    return pattern;
  }

  const substringLength = Math.round(PREVIEW_WIDTH[size] * 0.4);

  return `${pattern.substring(0, substringLength)} … ${pattern.substring(length - substringLength)}`;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    pattern: css({
      cursor: 'pointer',
      display: 'flex',
      fontFamily: 'monospace',
      gap: theme.spacing(0.25),
      overflow: 'hidden',
    }),
    removeButton: css({
      paddingLeft: 2.5,
      paddingRight: 2.5,
    }),
    tag: css({
      backgroundColor: theme.colors.secondary.main,
      border: `solid 1px ${theme.colors.secondary.border}`,
      borderBottomRightRadius: 0,
      borderTopRightRadius: 0,
      boxSizing: 'border-box',
      color: theme.colors.secondary.text,
      overflow: 'hidden',
      padding: theme.spacing(0.25, 0.75),
      textOverflow: 'ellipsis',
    }),
  };
};
