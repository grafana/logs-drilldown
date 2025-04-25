import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2 } from '@grafana/ui';

import { addCurrentUrlToHistory } from '../../services/navigate';
import { AppliedPattern } from '../../services/variables';
import { PatternTag } from './PatternTag';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { testIds } from 'services/testIds';

type Props = {
  onRemove: (patterns: AppliedPattern[]) => void;
  patterns: AppliedPattern[] | undefined;
};
export const PatternControls = ({ onRemove, patterns }: Props) => {
  const styles = useStyles2(getStyles);

  if (!patterns || patterns.length === 0) {
    return null;
  }

  const includePatterns = patterns.filter((pattern) => pattern.type === 'include');
  const excludePatterns = patterns.filter((pattern) => pattern.type !== 'include');

  const onRemovePattern = (pattern: AppliedPattern) => {
    addCurrentUrlToHistory();
    onRemove(patterns.filter((pat) => pat !== pattern));
    reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.pattern_removed, {
      excludePatternsLength: excludePatterns.length - (pattern?.type !== 'include' ? 1 : 0),
      includePatternsLength: includePatterns.length - (pattern?.type === 'include' ? 1 : 0),
      type: pattern.type,
    });
  };

  return (
    <div>
      {includePatterns.length > 0 && (
        <div className={styles.patternsContainer}>
          <Text variant="bodySmall" weight="bold" data-testid={testIds.patterns.buttonIncludedPattern}>
            Included pattern{patterns.length > 1 ? 's' : ''}
          </Text>
          <div className={styles.patterns}>
            {includePatterns.map((p) => (
              <PatternTag key={p.pattern} pattern={p.pattern} size="lg" onRemove={() => onRemovePattern(p)} />
            ))}
          </div>
        </div>
      )}
      {excludePatterns.length > 0 && (
        <div className={styles.patternsContainer}>
          <Text variant="bodySmall" weight="bold" data-testid={testIds.patterns.buttonExcludedPattern}>
            Excluded pattern{excludePatterns.length > 1 ? 's' : ''}:
          </Text>
          <div className={styles.patterns}>
            {excludePatterns.map((p) => (
              <PatternTag
                key={p.pattern}
                pattern={p.pattern}
                size={excludePatterns.length > 1 ? 'sm' : 'lg'}
                onRemove={() => onRemovePattern(p)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    patterns: css({
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    }),
    patternsContainer: css({
      overflow: 'hidden',
    }),
  };
}
