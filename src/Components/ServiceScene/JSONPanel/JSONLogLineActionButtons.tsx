import React from 'react';

import { isNumber } from 'lodash';

import { DataFrame, Field, TimeRange } from '@grafana/data';
import { SceneDataProvider, sceneGraph } from '@grafana/scenes';

import { isLogLineField, isLogsIdField } from '../../../services/fields';
import { logger } from '../../../services/logger';
import { copyText, generateLogShortlink } from '../../../services/text';
import CopyToClipboardButton from '../../Buttons/CopyToClipboardButton';
import { JSONLogsScene } from '../JSONLogsScene';
import { getLogsPanelFrame } from '../ServiceScene';
import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';

interface Props {
  keyPath: KeyPath;
  model: JSONLogsScene;
}
export function JSONLogLineActionButtons({ model, keyPath }: Props) {
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

const copyLogLine = (keyPath: KeyPath, $data: SceneDataProvider) => {
  const logLineIndex = keyPath[0];
  const dataFrame = getLogsPanelFrame($data.state.data);
  const lineField = dataFrame?.fields.find((f) => isLogLineField(f.name));
  if (isNumber(logLineIndex) && lineField) {
    const line = lineField.values[logLineIndex];
    copyText(line.toString());
  }
};

function getLinkToLog(keyPath: KeyPath, timeRange: TimeRange, rawFrame: DataFrame | undefined) {
  const idField: Field<string> | undefined = rawFrame?.fields.find((f) => isLogsIdField(f.name));
  const logLineIndex = keyPath[0];
  if (!isNumber(logLineIndex)) {
    const error = Error('Invalid line index');
    logger.error(error, { msg: 'Error getting log line index' });
    throw error;
  }
  const logId = idField?.values[logLineIndex];
  const logLineLink = generateLogShortlink('selectedLine', { id: logId, row: logLineIndex }, timeRange);
  copyText(logLineLink);
}
