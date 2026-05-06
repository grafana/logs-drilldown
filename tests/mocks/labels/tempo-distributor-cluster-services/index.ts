/**
 * Hand-extended `LABEL_BREAKDOWN_VALUES.service_name` frames for the
 * `should replace service_name with cluster in url` test, which clears the
 * `service_name` filter, drills into `cluster=eu-west-1`, then clicks
 * "Select service_name" and expects to see panels for multiple services
 * (including `nginx`).
 *
 * The captured `service_name-tempo-distributor` fixture only contains a
 * single `service_name=tempo-distributor` frame because that's the URL it was
 * captured at. We clone the captured frame and relabel it for several
 * services so the breakdown can render the panels the test asserts on.
 */
import clusterUsOnlyFrames from './clusterUsOnlyFrames.json';
import serviceNameFrames from './serviceNameFrames.json';

import { dsQuery, labelsBreakdown as baseBreakdown } from '../service_name-tempo-distributor';

import type { LabelsBreakdownFixture } from '../service_name-tempo-ingester';

export { dsQuery };

export const labelsBreakdown: LabelsBreakdownFixture = {
  ...baseBreakdown,
  LABEL_BREAKDOWN_VALUES: {
    ...baseBreakdown.LABEL_BREAKDOWN_VALUES,
    service_name: serviceNameFrames as { frames: unknown[]; status: number },
  },
};

/**
 * Variant that scopes `cluster` to `us-*` only — for the `combobox should
 * replace service_name with regex cluster` test, which adds a `cluster=~us-.+`
 * filter and expects only the three `us-*` panels to render.
 */
export const labelsBreakdownUsClustersOnly: LabelsBreakdownFixture = {
  ...baseBreakdown,
  LABEL_BREAKDOWN_VALUES: {
    ...baseBreakdown.LABEL_BREAKDOWN_VALUES,
    cluster: clusterUsOnlyFrames as { frames: unknown[]; status: number },
    service_name: serviceNameFrames as { frames: unknown[]; status: number },
  },
};
