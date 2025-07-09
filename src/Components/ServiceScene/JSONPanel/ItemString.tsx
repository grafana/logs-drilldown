import React from 'react';

import { rootNodeItemString } from '../../../services/JSONViz';
import { hasProp } from '../../../services/narrowing';
import { JsonDataFrameTimeName, JsonVizRootName, LogsJsonScene } from '../LogsJsonScene';
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

  return <span>{itemType}</span>;
}
