import { t } from '@grafana/i18n';

import { DATAPLANE_TIME_NAME_LEGACY } from '../../services/logsFrame';

export const OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME = '___OTEL_LOG_ATTRIBUTES___';
export const LOG_LINE_BODY_FIELD_NAME = '___LOG_LINE_BODY___';
export const LOG_LINE_TIME_FIELD_NAME = DATAPLANE_TIME_NAME_LEGACY;

export function getNormalizedFieldName(field: string) {
  if (field === LOG_LINE_BODY_FIELD_NAME) {
    return t('logs.logs-drilldown.fields.log-line-field', 'Log line');
  } else if (field === OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME) {
    return t('logs.logs-drilldown.fields.log-attributes-field', 'Log attributes');
  }
  return field;
}
