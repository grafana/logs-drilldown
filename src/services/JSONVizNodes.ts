import {
  JsonDataFrameLabelsName,
  JsonDataFrameStructuredMetadataName,
  JsonDataFrameTimeName,
} from '../Components/ServiceScene/LogsJsonScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';

/**
 * Determines if the current node is the timestamp label
 * @param keyPath
 */
export const isTimeLabelNode = (keyPath: KeyPath) => {
  return keyPath[0] === JsonDataFrameTimeName;
};

export const hasValidParentNode = (keyPath: KeyPath) => {
  return (
    keyPath[1] !== undefined &&
    keyPath[1] !== JsonDataFrameStructuredMetadataName &&
    keyPath[1] !== JsonDataFrameLabelsName
  );
};
