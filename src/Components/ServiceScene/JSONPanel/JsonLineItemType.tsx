import React, { memo } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AdHocFilterWithLabels, SceneObject } from '@grafana/scenes';
import { Tooltip, useStyles2 } from '@grafana/ui';

import { addToFilters } from '../Breakdowns/AddToFiltersButton';
import { JSON_VIZ_LINE_HEIGHT } from './LogsJsonComponent';
import { FilterOp } from 'services/filterTypes';
import { logsLabelLevelsMatches } from 'services/panel';
import { LEVEL_VARIABLE_VALUE, VAR_LEVELS } from 'services/variables';

function JsonLineItemType({
  detectedLevel,
  sceneRef,
  levelsVarFilters,
}: {
  detectedLevel: string;
  levelsVarFilters: AdHocFilterWithLabels[];
  sceneRef: SceneObject;
}) {
  const styles = useStyles2(getStyles);
  const levelClass = Object.keys(logsLabelLevelsMatches).find((className) =>
    detectedLevel.match(logsLabelLevelsMatches[className])
  );
  const existingFilter = levelsVarFilters.some(
    (filter) => filter.value === detectedLevel && filter.operator === FilterOp.Equal
  );

  return (
    <Tooltip
      content={t(
        'logs.json.line.detectedLevel.toggleButton',
        existingFilter ? `Remove ${detectedLevel} filter` : `Include logs with ${detectedLevel} level`
      )}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          addToFilters(LEVEL_VARIABLE_VALUE, detectedLevel, 'toggle', sceneRef, VAR_LEVELS);
        }}
        className={`${levelClass} ${styles.levelButtonStyles}`}
      >
        {detectedLevel.toUpperCase()}
      </button>
    </Tooltip>
  );
}

export default memo(JsonLineItemType);

const getStyles = (theme: GrafanaTheme2) => {
  return {
    levelButtonStyles: css({
      height: JSON_VIZ_LINE_HEIGHT,
      marginLeft: '12px',
      fontFamily: theme.typography.fontFamilyMonospace,
      appearance: 'none',
      background: 'none',
      border: 'none',
      fontSize: '0.9em',
      // Keep button padding from pushing text further than other item string
      padding: theme.spacing(0, 0.5, 0, 0.5),
      '&:hover, &:focus': {
        background: theme.colors.background.elevated,
      },
    }),
  };
};
