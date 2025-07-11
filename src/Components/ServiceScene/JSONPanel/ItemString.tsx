import React from 'react';

import { css } from '@emotion/css';

import { Field, FieldType, GrafanaTheme2, Labels } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { isLabelsField } from '../../../services/fields';
import { itemStringStyles, levelButtonStyles, rootNodeItemString } from '../../../services/JSONViz';
import { hasProp } from '../../../services/narrowing';
import { logsLabelLevelsMatches } from '../../../services/panel';
import { LEVEL_VARIABLE_VALUE, VAR_LEVELS } from '../../../services/variables';
import { addToFilters } from '../Breakdowns/AddToFiltersButton';
import { JsonDataFrameLineName, JsonDataFrameTimeName, JsonVizRootName, LogsJsonScene } from '../LogsJsonScene';
import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';

interface ItemStringProps {
  data: unknown;
  itemString: string;
  itemType: React.ReactNode;
  keyPath: KeyPath;
  model: LogsJsonScene;
  nodeType: string;
}
export default function ItemString({ data, itemString, itemType, keyPath, model }: ItemStringProps) {
  const styles = useStyles2(getStyles);
  if (data && hasProp(data, JsonDataFrameTimeName) && typeof data.Time === 'string') {
    return model.renderCopyToClipboardButton(keyPath);
  }

  if (keyPath[0] === JsonVizRootName) {
    return (
      <span className={rootNodeItemString}>
        {itemType} {itemString}
      </span>
    );
  }

  if (keyPath[0] === JsonDataFrameLineName) {
    const labelsField: Field<Labels> | undefined = model.state.rawFrame?.fields.find(
      (f) => f.type === FieldType.other && isLabelsField(f.name)
    );
    const index = typeof keyPath[1] === 'number' ? keyPath[1] : undefined;
    const labels = index !== undefined ? labelsField?.values[index] : undefined;
    const detected_level = labels?.[LEVEL_VARIABLE_VALUE];

    if (detected_level) {
      const levelClass = Object.keys(logsLabelLevelsMatches).find((className) =>
        detected_level.match(logsLabelLevelsMatches[className])
      );
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            addToFilters(LEVEL_VARIABLE_VALUE, detected_level, 'toggle', model, VAR_LEVELS);
          }}
          className={`${levelClass} ${styles.levelButtonStyles}`}
        >
          {detected_level.toUpperCase()}
        </button>
      );
    }
  }

  return <span className={itemStringStyles}>{itemType}</span>;
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
