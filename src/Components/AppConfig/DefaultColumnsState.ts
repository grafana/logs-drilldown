import { areArraysEqual } from '../../services/comparison';
import {
  DefaultColumnsState,
  LocalDefaultColumnsState,
  LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords,
} from './types';

/**
 * Does the local stage have changes that aren't saved in the latest API response?
 * @param localDefaultColumnsState
 * @param apiDefaultColumnsState
 */
export const isDefaultColumnsStateChanged = (
  localDefaultColumnsState: LocalDefaultColumnsState,
  apiDefaultColumnsState: DefaultColumnsState | null | undefined
) => {
  return (
    localDefaultColumnsState &&
    Object.keys(localDefaultColumnsState).some((key) => {
      const lhs: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords | undefined =
        localDefaultColumnsState?.[key]?.records;
      const rhs: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords | undefined =
        apiDefaultColumnsState?.[key]?.records;
      return !(lhs && rhs && areArraysEqual(lhs, rhs));
    })
  );
};
