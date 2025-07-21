import React from 'react';

import { isNumber } from 'lodash';

import { Field } from '@grafana/data';
import { AdHocFiltersVariable, AdHocFilterWithLabels } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import {
  JsonDataFrameLabelsName,
  JsonDataFrameLinksName,
  JsonDataFrameStructuredMetadataName,
  JsonDataFrameTimeName,
  JsonLinksDisplayName,
  JsonVizRootName,
  LabelsDisplayName,
  JSONLogsScene,
  NodeType,
  StructuredMetadataDisplayName,
} from '../JSONLogsScene';
import { JSONLeafLabel } from './JSONLeafLabel';
import { JSONParentNodeFilterButtons } from './JSONParentNodeFilterButtons';
import JSONRootNodeNavigation from './JSONRootNodeNavigation';
import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';
import { isLogLineField } from 'services/fields';
import { getJsonLabelWrapStyles, jsonLabelWrapStylesPrimary } from 'services/JSONViz';
import { isTimeLabelNode } from 'services/JSONVizNodes';

interface LabelRendererProps {
  fieldsVar: AdHocFiltersVariable;
  jsonFiltersSupported: boolean | undefined;
  jsonParserPropsMap: Map<string, AdHocFilterWithLabels>;
  keyPath: KeyPath;
  lineField: Field;
  lineFilters: AdHocFilterWithLabels[];
  model: JSONLogsScene;
  nodeType: string;
}

export default function LabelRenderer({
  fieldsVar,
  jsonFiltersSupported,
  jsonParserPropsMap,
  keyPath,
  lineField,
  lineFilters,
  model,
  nodeType,
}: LabelRendererProps) {
  const style = useStyles2(getJsonLabelWrapStyles);
  const value: string | Array<string | React.JSX.Element> = keyPath[0].toString();
  const nodeTypeLoc = nodeType as NodeType;

  // Specific implementations for leaf nodes
  // Metadata node
  if (keyPath[0] === JsonDataFrameStructuredMetadataName) {
    return <strong className={style.jsonLabelWrapStyles}>{StructuredMetadataDisplayName}</strong>;
  }
  // Labels node
  if (keyPath[0] === JsonDataFrameLabelsName) {
    return <strong className={style.jsonLabelWrapStyles}>{LabelsDisplayName}</strong>;
  }
  // Links parent
  if (keyPath[0] === JsonDataFrameLinksName) {
    return <strong className={style.jsonLabelWrapStyles}>{JsonLinksDisplayName}</strong>;
  }
  // Links node
  if (keyPath[1] === JsonDataFrameLinksName) {
    return <strong className={style.jsonLabelWrapStyles}>{value}:</strong>;
  }
  // Root node
  if (keyPath[0] === JsonVizRootName) {
    return <JSONRootNodeNavigation sceneRef={model} />;
  }

  // Value nodes
  if (isJSONLeafNode(nodeTypeLoc, keyPath)) {
    return (
      <JSONLeafLabel
        logsJsonScene={model}
        keyPath={keyPath}
        lineField={lineField}
        fieldsVar={fieldsVar}
        jsonParserPropsMap={jsonParserPropsMap}
        lineFilters={lineFilters}
        jsonFiltersSupported={jsonFiltersSupported}
      />
    );
  }

  // Parent nodes
  if (isJSONParentNode(nodeTypeLoc, keyPath)) {
    return (
      <JSONParentNodeFilterButtons
        keyPath={keyPath}
        lineFilters={lineFilters}
        logsJsonScene={model}
        fieldsFilters={fieldsVar.state.filters}
        jsonParserPropsMap={jsonParserPropsMap}
        jsonFiltersSupported={jsonFiltersSupported}
      />
    );
  }

  // Show the timestamp as the label of the log line
  if (isTimestampNode(keyPath) && isNumber(keyPath[0])) {
    const time: string = lineField.values[keyPath[0]]?.[JsonDataFrameTimeName];
    return <strong className={jsonLabelWrapStylesPrimary}>{time}</strong>;
  }

  // Don't render time node
  if (isTimeLabelNode(keyPath)) {
    return null;
  }

  return <strong className={style.jsonLabelWrapStyles}>{value}:</strong>;
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
    keyPath[0] !== JsonDataFrameTimeName &&
    !isLogLineField(keyPath[0].toString()) &&
    keyPath[0] !== JsonVizRootName &&
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
    keyPath[0] !== JsonVizRootName &&
    !isNumber(keyPath[0])
  );
};

const isTimestampNode = (keyPath: KeyPath) => {
  return keyPath[1] === JsonVizRootName;
};
