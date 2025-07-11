import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObject } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { logsLabelLevelsMatches } from '../../../services/panel';
import { LEVEL_VARIABLE_VALUE, VAR_LEVELS } from '../../../services/variables';
import { addToFilters } from '../Breakdowns/AddToFiltersButton';

export function JsonLineItemType({ detectedLevel, sceneRef }: { detectedLevel: string; sceneRef: SceneObject }) {
  const styles = useStyles2(getStyles);
  const levelClass = Object.keys(logsLabelLevelsMatches).find((className) =>
    detectedLevel.match(logsLabelLevelsMatches[className])
  );
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        addToFilters(LEVEL_VARIABLE_VALUE, detectedLevel, 'toggle', sceneRef, VAR_LEVELS);
      }}
      className={`${levelClass} ${styles.levelButtonStyles}`}
    >
      {detectedLevel.toUpperCase()}
    </button>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    levelButtonStyles: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      appearance: 'none',
      background: 'none',
      border: 'none',
      padding: 0,
    }),
  };
};
