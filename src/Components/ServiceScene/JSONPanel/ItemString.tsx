import React from 'react';

import { css } from '@emotion/css';

import { Field, FieldType, GrafanaTheme2, Labels } from '@grafana/data';
import { AdHocFiltersVariable } from '@grafana/scenes';
import { Icon, useStyles2 } from '@grafana/ui';

import { isLabelsField } from '../../../services/fields';
import { rootNodeItemString } from '../../../services/JSONViz';
import { hasProp } from '../../../services/narrowing';
import { LEVEL_VARIABLE_VALUE } from '../../../services/variables';
import {
  JsonDataFrameLineName,
  JsonDataFrameLinksName,
  JsonDataFrameTimeName,
  JsonVizRootName,
  LogsJsonScene,
} from '../LogsJsonScene';
import JsonLineItemType from './JsonLineItemType';
import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';

interface ItemStringProps {
  data: unknown;
  itemString: string;
  itemType: React.ReactNode;
  keyPath: KeyPath;
  levelsVar: AdHocFiltersVariable;
  model: LogsJsonScene;
  nodeType: string;
}

export default function ItemString({ data, itemString, itemType, keyPath, model, levelsVar }: ItemStringProps) {
  const styles = useStyles2(getStyles);
  if (data && hasProp(data, JsonDataFrameTimeName) && typeof data.Time === 'string') {
    return model.renderLogLineActionButtons(keyPath, model);
  }

  if (keyPath[0] === JsonVizRootName) {
    return (
      <span className={rootNodeItemString}>
        {itemType} {itemString}
      </span>
    );
  }

  if (keyPath[0] === JsonDataFrameLineName) {
    const detectedLevel = getJsonDetectedLevel(model, keyPath);

    if (detectedLevel) {
      return (
        <JsonLineItemType sceneRef={model} detectedLevel={detectedLevel} levelsVarFilters={levelsVar.state.filters} />
      );
    }
  }

  if (keyPath[0] === JsonDataFrameLinksName) {
    return (
      <span className={styles.wrapper}>
        <Icon size={'sm'} name={'link'} />
      </span>
    );
  }

  return <span className={styles.wrapper}>{itemType}</span>;
}

const getJsonDetectedLevel = (model: LogsJsonScene, keyPath: KeyPath) => {
  const labelsField: Field<Labels> | undefined = model.state.rawFrame?.fields.find(
    (f) => f.type === FieldType.other && isLabelsField(f.name)
  );
  const index = typeof keyPath[1] === 'number' ? keyPath[1] : undefined;
  const labels = index !== undefined ? labelsField?.values[index] : undefined;
  return labels?.[LEVEL_VARIABLE_VALUE];
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    color: theme.colors.emphasize(theme.colors.text.secondary, 0.33),
    display: 'inline-flex',
    alignItems: 'center',
    height: '22px',
  }),
});
