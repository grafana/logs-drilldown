/**
 * `{service_name="tempo-distributor"} |~ "(?i)broadcast"` — captured
 * `logsPanelQuery` response trimmed to 20 broadcast-containing lines so the
 * `should filter logs panel on search for broadcast field` test can assert
 * "first log line contains 'broadcast'".
 *
 * All other endpoints (detected_fields, detected_labels, breakdown panels)
 * fall back to `service_name-tempo-distributor` in the layered scenario
 * stack — only `logsPanelQuery` differs here.
 */
import dsQueryData from './dsQuery.json';

import type { DsQueryEntry } from '../service_name-tempo-ingester';

export const dsQuery = dsQueryData as DsQueryEntry[];
