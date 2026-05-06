/**
 * Plain-data fixtures for `{service_name="nginx-json-mixed"}`.
 *
 * Used by `tests/exploreServicesJsonMixedBreakDown.spec.ts` to exercise the
 * mixed json + logfmt parser path. See `../service_name-tempo-ingester/index.ts`
 * for the canonical reference.
 */
import dsQueryData from './dsQuery.json';
import labelsBreakdownData from './labelsBreakdown.json';

import { detectedFields } from './detectedFields';
import { detectedLabels } from './detectedLabels';
import { fieldValues } from './fieldValues';
import { labelValues } from './labelValues';
import { patterns } from './patterns';

import type { DsQueryEntry, LabelsBreakdownFixture } from '../service_name-tempo-ingester';

export const dsQuery = dsQueryData as DsQueryEntry[];
export const labelsBreakdown = labelsBreakdownData as unknown as LabelsBreakdownFixture;

export { detectedFields, detectedLabels, fieldValues, labelValues, patterns };
