import React, { memo } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AdHocFiltersVariable, SceneObject } from '@grafana/scenes';
import { Tooltip, useStyles2 } from '@grafana/ui';

import { FilterOp } from '../../../services/filterTypes';
import { logsLabelLevelsMatches } from '../../../services/panel';
import { LEVEL_VARIABLE_VALUE, VAR_LEVELS } from '../../../services/variables';
import { addToFilters } from '../Breakdowns/AddToFiltersButton';

function JsonLineItemType({
  detectedLevel,
  sceneRef,
  levelsVar,
}: {
  detectedLevel: string;
  levelsVar: AdHocFiltersVariable;
  sceneRef: SceneObject;
}) {
  const styles = useStyles2(getStyles);
  const levelClass = Object.keys(logsLabelLevelsMatches).find((className) =>
    detectedLevel.match(logsLabelLevelsMatches[className])
  );
  const existingLevel = levelsVar.state.filters.some(
    (filter) => filter.value === detectedLevel && filter.operator === FilterOp.Equal
  );

  return (
    <Tooltip
      content={t(
        'logs.json.line.detectedLevel.toggleButton',
        existingLevel ? `Remove ${detectedLevel} filter` : `Include logs with ${detectedLevel} level`
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
      height: '22px',
      fontFamily: theme.typography.fontFamilyMonospace,
      appearance: 'none',
      background: 'none',
      border: '1px solid',
      fontSize: '0.9em',
      // Keep button padding from pushing text further than other item string
      padding: theme.spacing(0, 0.5, 0, 0.5),
      '&:hover, &:focus': {
        background: theme.colors.background.elevated,
      },
    }),
  };
};
