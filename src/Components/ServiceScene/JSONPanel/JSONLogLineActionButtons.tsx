import React from 'react';

import { isNumber } from 'lodash';

import { DataFrame, Field } from '@grafana/data';
import { SceneDataProvider, sceneGraph } from '@grafana/scenes';

import { isLogLineField, isLogsIdField } from '../../../services/fields';
import { logger } from '../../../services/logger';
import { copyText, generateLogRowShortlink, getPermalinkLogRowFromDataFrame } from '../../../services/text';
import CopyToClipboardButton from '../../Buttons/CopyToClipboardButton';
import { JSONLogsScene } from '../JSONLogsScene';
import { getLogsPanelFrame } from '../ServiceScene';
import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';

interface Props {
  keyPath: KeyPath;
  model: JSONLogsScene;
}
export function JSONLogLineActionButtons({ model, keyPath }: Props) {
  return (
    <>
      <CopyToClipboardButton onClick={() => copyLogLine(keyPath, sceneGraph.getData(model))} />
      <CopyToClipboardButton type={'share-alt'} onClick={() => getLinkToLog(keyPath, model.state.rawFrame)} />
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

function getLinkToLog(keyPath: KeyPath, rawFrame: DataFrame | undefined) {
  const logLineIndex = keyPath[0];
  if (!isNumber(logLineIndex)) {
    const error = Error('Invalid line index');
    logger.error(error, { msg: 'Error getting log line index' });
    throw error;
  }
  if (!rawFrame) {
    return;
  }

  const row = getPermalinkLogRowFromDataFrame(rawFrame, logLineIndex);
  if (!row) {
    return;
  }

  const idField: Field<string> | undefined = rawFrame.fields.find((f) => isLogsIdField(f.name));
  const logId = idField?.values[logLineIndex];
  // The JSON view scrolls to and highlights the line from the `selectedLine` url param.
  const logLineLink = generateLogRowShortlink(row, { id: logId, row: logLineIndex }, 'selectedLine');
  copyText(logLineLink);
}
