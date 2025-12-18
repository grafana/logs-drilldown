import {
  DATAPLANE_BODY_NAME,
  DATAPLANE_LINE_NAME_LEGACY,
  DATAPLANE_TIME_NAME_LEGACY,
  DATAPLANE_TIMESTAMP_NAME,
} from '../../services/logsFrame';
import { LOG_LINE_TIME_FIELD_NAME } from '../ServiceScene/LogPanels';

export const DETECTED_LEVEL = 'detected_level';
export const LEVEL = 'level';
export const DEFAULT_URL_COLUMNS = [
  DATAPLANE_TIMESTAMP_NAME,
  DATAPLANE_BODY_NAME,
  DATAPLANE_TIME_NAME_LEGACY,
  DATAPLANE_LINE_NAME_LEGACY,
];
export const DEFAULT_DISPLAYED_FIELDS = [
  LOG_LINE_TIME_FIELD_NAME,
  DETECTED_LEVEL,
  // @todo adding otel only when feature flag is set
  // OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME,
];
