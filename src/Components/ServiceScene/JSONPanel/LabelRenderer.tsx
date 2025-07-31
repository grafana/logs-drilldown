import React from 'react';

import { isNumber } from 'lodash';

import { Field } from '@grafana/data';
import { AdHocFiltersVariable, AdHocFilterWithLabels } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import {
  JSONDataFrameLabelsName,
  JSONDataFrameLinksName,
  JSONDataFrameStructuredMetadataName,
  JSONDataFrameTimeName,
  JSONLinksDisplayName,
  JSONVizRootName,
  JSONLabelsDisplayName,
  JSONLogsScene,
  NodeType,
  JSONStructuredMetadataDisplayName,
} from '../JSONLogsScene';
import { JSONLeafLabel } from './JSONLeafLabel';
import { JSONParentNodeFilterButtons } from './JSONParentNodeFilterButtons';
import JSONRootNodeNavigation from './JSONRootNodeNavigation';
import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';
import { isLogLineField } from 'services/fields';
import { getJSONLabelWrapStyles, JSONLabelWrapStylesPrimary } from 'services/JSONViz';
import { isTimeLabelNode } from 'services/JSONVizNodes';

interface LabelRendererProps {
  fieldsVar: AdHocFiltersVariable;
  JSONFiltersSupported: boolean | null;
  JSONParserPropsMap: Map<string, AdHocFilterWithLabels>;
  keyPath: KeyPath;
  lineField: Field;
  lineFilters: AdHocFilterWithLabels[];
  model: JSONLogsScene;
  nodeType: string;
}

export default function LabelRenderer({
  fieldsVar,
  JSONFiltersSupported,
  JSONParserPropsMap,
  keyPath,
  lineField,
  lineFilters,
  model,
  nodeType,
}: LabelRendererProps) {
  const style = useStyles2(getJSONLabelWrapStyles);
  const value: string | Array<string | React.JSX.Element> = keyPath[0].toString();
  const nodeTypeLoc = nodeType as NodeType;

  // Specific implementations for leaf nodes
  // Metadata node
  if (keyPath[0] === JSONDataFrameStructuredMetadataName) {
    return <strong className={style.JSONLabelWrapStyles}>{JSONStructuredMetadataDisplayName}</strong>;
  }
  // Labels node
  if (keyPath[0] === JSONDataFrameLabelsName) {
    return <strong className={style.JSONLabelWrapStyles}>{JSONLabelsDisplayName}</strong>;
  }
  // Links parent
  if (keyPath[0] === JSONDataFrameLinksName) {
    return <strong className={style.JSONLabelWrapStyles}>{JSONLinksDisplayName}</strong>;
  }
  // Links node
  if (keyPath[1] === JSONDataFrameLinksName) {
    return <strong className={style.JSONLabelWrapStyles}>{value}:</strong>;
  }
  // Root node
  if (keyPath[0] === JSONVizRootName) {
    return <JSONRootNodeNavigation sceneRef={model} />;
  }

  // Value nodes
  if (isJSONLeafNode(nodeTypeLoc, keyPath)) {
    return (
      <JSONLeafLabel
        JSONLogsScene={model}
        keyPath={keyPath}
        lineField={lineField}
        fieldsVar={fieldsVar}
        JSONParserPropsMap={JSONParserPropsMap}
        lineFilters={lineFilters}
        JSONFiltersSupported={JSONFiltersSupported}
      />
    );
  }

  // Parent nodes
  if (isJSONParentNode(nodeTypeLoc, keyPath)) {
    return (
      <JSONParentNodeFilterButtons
        keyPath={keyPath}
        lineFilters={lineFilters}
        JSONLogsScene={model}
        fieldsFilters={fieldsVar.state.filters}
        JSONParserPropsMap={JSONParserPropsMap}
        JSONFiltersSupported={JSONFiltersSupported}
      />
    );
  }

  // Show the timestamp as the label of the log line
  if (isTimestampNode(keyPath) && isNumber(keyPath[0])) {
    const time: string = lineField.values[keyPath[0]]?.[JSONDataFrameTimeName];
    return <strong className={JSONLabelWrapStylesPrimary}>{time}</strong>;
  }

  // Don't render time node
  if (isTimeLabelNode(keyPath)) {
    return null;
  }

  return <strong className={style.JSONLabelWrapStyles}>{value}:</strong>;
}

/**
 * Is JSON node a leaf node
 * @param nodeTypeLoc
 * @param keyPath
 */
const isJSONLeafNode = (nodeTypeLoc: NodeType, keyPath: KeyPath) => {
  return (
    nodeTypeLoc !== 'Object' &&
    nodeTypeLoc !== 'Array' &&
    keyPath[0] !== JSONDataFrameTimeName &&
    !isLogLineField(keyPath[0].toString()) &&
    keyPath[0] !== JSONVizRootName &&
    !isNumber(keyPath[0])
  );
};

/**
 * Is JSON node a parent node
 * @param nodeTypeLoc
 * @param keyPath
 */
const isJSONParentNode = (nodeTypeLoc: NodeType, keyPath: KeyPath) => {
  return (
    (nodeTypeLoc === 'Object' || nodeTypeLoc === 'Array') &&
    !isLogLineField(keyPath[0].toString()) &&
    keyPath[0] !== JSONVizRootName &&
    !isNumber(keyPath[0])
  );
};

const isTimestampNode = (keyPath: KeyPath) => {
  return keyPath[1] === JSONVizRootName;
};
