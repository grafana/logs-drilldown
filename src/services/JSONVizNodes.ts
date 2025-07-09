import { JsonDataFrameTimeName } from '../Components/ServiceScene/LogsJsonScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';

/**
 * Determines if the current node is the timestamp label
 * @param keyPath
 */
export const isTimeLabelNode = (keyPath: KeyPath) => {
  return keyPath[0] === JsonDataFrameTimeName;
};
