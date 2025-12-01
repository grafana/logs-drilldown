import { areArraysEqual } from '../../services/comparison';
import {
  DefaultColumnsState,
  LocalDefaultColumnsState,
  LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords,
} from './types';

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
