import React from 'react';

import { isNumber } from 'lodash';

import { Field } from '@grafana/data';
import { AdHocFiltersVariable, AdHocFilterWithLabels } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { isLogLineField } from '../../../services/fields';
import { getJsonLabelWrapStyles, jsonLabelWrapStylesPrimary } from '../../../services/JSONViz';
import { isTimeLabelNode } from '../../../services/JSONVizNodes';
import {
  JsonDataFrameLabelsName,
  JsonDataFrameLinksName,
  JsonDataFrameStructuredMetadataName,
  JsonDataFrameTimeName,
  JsonLinksDisplayName,
  JsonVizRootName,
  LabelsDisplayName,
  LogsJsonScene,
  NodeTypeLoc,
  StructuredMetadataDisplayName,
} from '../LogsJsonScene';
import JsonRootNodeNavigation from './JsonRootNodeNavigation';
import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';

interface LabelRendererProps {
  fieldsVar: AdHocFiltersVariable;
  jsonFiltersSupported: boolean | undefined;
  jsonParserPropsMap: Map<string, AdHocFilterWithLabels>;
  keyPath: KeyPath;
  lineField: Field;
  lineFilters: AdHocFilterWithLabels[];
  model: LogsJsonScene;
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
  const nodeTypeLoc = nodeType as NodeTypeLoc;

  // Clean up internal names for special nodes
  if (keyPath[0] === JsonDataFrameStructuredMetadataName) {
    return <strong className={style.jsonLabelWrapStyles}>{StructuredMetadataDisplayName}</strong>;
  }
  if (keyPath[0] === JsonDataFrameLabelsName) {
    return <strong className={style.jsonLabelWrapStyles}>{LabelsDisplayName}</strong>;
  }
  if (keyPath[0] === JsonDataFrameLinksName) {
    return <strong className={style.jsonLabelWrapStyles}>{JsonLinksDisplayName}</strong>;
  }
  if (keyPath[1] === JsonDataFrameLinksName) {
    return <strong className={style.jsonLabelWrapStyles}>{value}:</strong>;
  }
  if (keyPath[0] === JsonVizRootName) {
    return <JsonRootNodeNavigation sceneRef={model} />;
  }

  // Value nodes
  if (isNodeValueNode(nodeTypeLoc, keyPath)) {
    return model.renderValueLabel(keyPath, lineField, fieldsVar, jsonParserPropsMap, lineFilters, jsonFiltersSupported);
  }

  // Parent nodes
  if (isNodeParentNode(nodeTypeLoc, keyPath)) {
    return model.renderNestedNodeFilterButtons(
      keyPath,
      fieldsVar,
      jsonParserPropsMap,
      lineFilters,
      jsonFiltersSupported
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
const isNodeValueNode = (nodeTypeLoc: NodeTypeLoc, keyPath: KeyPath) => {
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
const isNodeParentNode = (nodeTypeLoc: NodeTypeLoc, keyPath: KeyPath) => {
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
