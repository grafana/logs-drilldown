import {
  JSONDataFrameLabelsName,
  JSONDataFrameStructuredMetadataName,
  JSONDataFrameTimeName,
} from '../Components/ServiceScene/JSONLogsScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';

/**
 * Determines if the current node is the timestamp label
 * @param keyPath
 */
export const isTimeLabelNode = (keyPath: KeyPath) => {
  return keyPath[0] === JSONDataFrameTimeName;
};

/**
 * Does the node at keyPath have a metadata or labels parent node?
 * @param keyPath
 */
export const hasFieldParentNode = (keyPath: KeyPath) => {
  return keyPath[1] === JSONDataFrameStructuredMetadataName || keyPath[1] === JSONDataFrameLabelsName;
};
