import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

import { testIds } from 'services/testIds';

type Props = {
  buttonFill: 'outline' | 'solid' | 'text';
  hideExclude?: boolean;
  isExcluded: boolean;
  isIncluded: boolean;
  onClear: () => void;
  onExclude: () => void;
  onInclude: () => void;
  titles?: {
    exclude: string;
    include: string;
  };
};

export const FilterButton = (props: Props) => {
  const { buttonFill, hideExclude, isExcluded, isIncluded, onClear, onExclude, onInclude, titles } = props;
  const styles = useStyles2(getStyles, isIncluded, isExcluded, hideExclude);
  return (
    <div className={styles.container}>
      <Button
        variant={isIncluded ? 'primary' : 'secondary'}
        fill={buttonFill}
        size="sm"
        aria-selected={isIncluded}
        className={styles.includeButton}
        onClick={isIncluded ? onClear : onInclude}
        data-testid={testIds.exploreServiceDetails.buttonFilterInclude}
        title={titles?.include}
      >
        Include
      </Button>
      {!hideExclude && (
        <Button
          variant={isExcluded ? 'primary' : 'secondary'}
          fill={buttonFill}
          size="sm"
          aria-selected={isExcluded}
          className={styles.excludeButton}
          onClick={isExcluded ? onClear : onExclude}
          title={titles?.exclude}
          data-testid={testIds.exploreServiceDetails.buttonFilterExclude}
        >
          Exclude
        </Button>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, isIncluded: boolean, isExcluded: boolean, hideExclude?: boolean) => {
  return {
    container: css({
      display: 'flex',
      justifyContent: 'center',
    }),
    excludeButton: css({
      borderLeft: isExcluded ? undefined : 'none',
      borderRadius: `0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0`,
    }),
    includeButton: css({
      borderRadius: 0,
      borderRight: isIncluded || hideExclude ? undefined : 'none',
    }),
  };
};
