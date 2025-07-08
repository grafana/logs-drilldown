import React from 'react';

import { rootNodeItemString } from '../../../services/JSONViz';
import { hasProp } from '../../../services/narrowing';
import { JsonDataFrameTimeName, JsonVizRootName } from '../LogsJsonScene';
import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';

interface GetItemStringProps {
  data: unknown;
  itemString: string;
  itemType: React.ReactNode;
  keyPath: KeyPath;
  nodeType: string;
}
export default function ItemString({ data, itemString, itemType, keyPath }: GetItemStringProps) {
  if (data && hasProp(data, JsonDataFrameTimeName) && typeof data.Time === 'string') {
    return null;
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
