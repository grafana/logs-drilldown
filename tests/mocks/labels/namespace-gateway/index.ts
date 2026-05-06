/**
 * Plain-data fixtures for `{namespace="gateway"}`.
 *
 * Hand-written so the `tabs - namespace` block in `tests/exploreServices.spec.ts`
 * has distinct tab counts compared to `namespace-mimir`.
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
