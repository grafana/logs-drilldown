import React from 'react';

import { css } from '@emotion/css';
import { isNumber } from 'lodash';

import { DataFrame, Field, FieldType, GrafanaTheme2, Labels, TimeRange } from '@grafana/data';
import { AdHocFiltersVariable, SceneDataProvider, sceneGraph } from '@grafana/scenes';
import { Icon, useStyles2 } from '@grafana/ui';

import { isLabelsField, isLogLineField, isLogsIdField } from '../../../services/fields';
import { rootNodeItemString } from '../../../services/JSONViz';
import { logger } from '../../../services/logger';
import { hasProp } from '../../../services/narrowing';
import { copyText, generateLogShortlink } from '../../../services/text';
import { LEVEL_VARIABLE_VALUE } from '../../../services/variables';
import CopyToClipboardButton from '../../Buttons/CopyToClipboardButton';
import {
  JSONDataFrameLineName,
  JSONDataFrameLinksName,
  JSONDataFrameTimeName,
  JSONVizRootName,
  JSONLogsScene,
} from '../JSONLogsScene';
import { getLogsPanelFrame } from '../ServiceScene';
import { JSONLineItemType } from './JSONLineItemType';
import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';

interface ItemStringProps {
  data: unknown;
  itemString: string;
  itemType: React.ReactNode;
  keyPath: KeyPath;
  levelsVar: AdHocFiltersVariable;
  model: JSONLogsScene;
  nodeType: string;
}

export default function ItemString({ data, itemString, itemType, keyPath, model, levelsVar }: ItemStringProps) {
  const styles = useStyles2(getStyles);
  if (data && hasProp(data, JSONDataFrameTimeName) && typeof data.Time === 'string') {
    return renderLogLineActionButtons(keyPath, model);
  }

  // The root node, which is visualized as the breadcrumb navigation
  if (keyPath[0] === JSONVizRootName) {
    return (
      <span className={rootNodeItemString}>
        {itemType} {itemString}
      </span>
    );
  }

  // log line nodes render the log level as the "ItemString"
  if (keyPath[0] === JSONDataFrameLineName) {
    const detectedLevel = getJsonDetectedLevel(model, keyPath);

    if (detectedLevel) {
      return (
        <JSONLineItemType sceneRef={model} detectedLevel={detectedLevel} levelsVarFilters={levelsVar.state.filters} />
      );
    }
  }

  // Link nodes render the link icon
  if (keyPath[0] === JSONDataFrameLinksName) {
    return (
      <span className={styles.wrapper}>
        <Icon size={'sm'} name={'link'} />
      </span>
    );
  }

  // All other nodes return the itemType string from the library, e.g. [], {}
  return <span className={styles.wrapper}>{itemType}</span>;
}

export function renderLogLineActionButtons(keyPath: KeyPath, model: JSONLogsScene) {
  const timeRange = sceneGraph.getTimeRange(model).state.value;
  return (
    <>
      <CopyToClipboardButton onClick={() => copyLogLine(keyPath, sceneGraph.getData(model))} />
      <CopyToClipboardButton
        type={'share-alt'}
        onClick={() => getLinkToLog(keyPath, timeRange, model.state.rawFrame)}
      />
    </>
  );
}

function getLinkToLog(keyPath: KeyPath, timeRange: TimeRange, rawFrame: DataFrame | undefined) {
  const idField: Field<string> | undefined = rawFrame?.fields.find((f) => isLogsIdField(f.name));
  const logLineIndex = keyPath[0];
  if (!isNumber(logLineIndex)) {
    const error = Error('Invalid line index');
    logger.error(error, { msg: 'Error getting log line index' });
    throw error;
  }
  const logId = idField?.values[logLineIndex];
  const logLineLink = generateLogShortlink('panelState', { id: logId, row: logLineIndex }, timeRange);
  copyText(logLineLink);
}

const getJsonDetectedLevel = (model: JSONLogsScene, keyPath: KeyPath) => {
  const labelsField: Field<Labels> | undefined = model.state.rawFrame?.fields.find(
    (f) => f.type === FieldType.other && isLabelsField(f.name)
  );
  const index = typeof keyPath[1] === 'number' ? keyPath[1] : undefined;
  const labels = index !== undefined ? labelsField?.values[index] : undefined;
  return labels?.[LEVEL_VARIABLE_VALUE];
};

const copyLogLine = (keyPath: KeyPath, $data: SceneDataProvider) => {
  const logLineIndex = keyPath[0];
  const dataFrame = getLogsPanelFrame($data.state.data);
  const lineField = dataFrame?.fields.find((f) => isLogLineField(f.name));
  if (isNumber(logLineIndex) && lineField) {
    const line = lineField.values[logLineIndex];
    copyText(line.toString());
  }
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    color: theme.colors.emphasize(theme.colors.text.secondary, 0.33),
    display: 'inline-flex',
    alignItems: 'center',
    height: '22px',
  }),
});
