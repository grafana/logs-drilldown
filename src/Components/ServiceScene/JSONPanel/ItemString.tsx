import React from 'react';

import { Field, FieldType, Labels } from '@grafana/data';

import { isLabelsField } from '../../../services/fields';
import { itemStringStyles, rootNodeItemString } from '../../../services/JSONViz';
import { hasProp } from '../../../services/narrowing';
import { LEVEL_VARIABLE_VALUE } from '../../../services/variables';
import { JsonDataFrameLineName, JsonDataFrameTimeName, JsonVizRootName, LogsJsonScene } from '../LogsJsonScene';
import { JsonLineItemType } from './JsonLineItemType';
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
    const detectedLevel = getJsonDetectedLevel(model, keyPath);

    if (detectedLevel) {
      return <JsonLineItemType sceneRef={model} detectedLevel={detectedLevel} />;
    }
  }

  return <span className={itemStringStyles}>{itemType}</span>;
}

const getJsonDetectedLevel = (model: LogsJsonScene, keyPath: KeyPath) => {
  const labelsField: Field<Labels> | undefined = model.state.rawFrame?.fields.find(
    (f) => f.type === FieldType.other && isLabelsField(f.name)
  );
  const index = typeof keyPath[1] === 'number' ? keyPath[1] : undefined;
  const labels = index !== undefined ? labelsField?.values[index] : undefined;
  return labels?.[LEVEL_VARIABLE_VALUE];
};
