import { LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel } from '@grafana/api-clients';
import { AdHocFilterWithLabels } from '@grafana/scenes';

import { ExpressionBuilder } from '../../services/ExpressionBuilder';
import { LabelFilterOp } from '../../services/filterTypes';
import { LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabels } from './types';

/**
 * Map columns labels API response to AdHocFilters so we can re-use existing TagKeysProviders
 * @param columnsLabels
 */
export const mapColumnsLabelsToAdHocFilters = (
  columnsLabels: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabels
) => {
  return columnsLabels
    .filter((label): label is LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel => !!label.value && !!label.key)
    .map((label) => ({
      key: label.key,
      value: label.value,
      operator: LabelFilterOp.Equal,
    }));
};

export const getColumnsLabelsExpr = (labelFilters: AdHocFilterWithLabels[]): string => {
  const filtersTransformer = new ExpressionBuilder(labelFilters);
  return filtersTransformer.getLabelsExpr();
};
