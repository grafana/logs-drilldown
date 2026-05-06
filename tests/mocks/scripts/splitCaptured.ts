/**
 * Split the raw recordings in `tests/mocks/captured/*.json` (produced by
 * `tests/recordExploreMocks.spec.ts`) into per-service fixture files under
 * `tests/mocks/labels/service_name-<svc>/`.
 *
 * Run via `pnpm mocks:split` after a fresh recording session.
 *
 * The script is idempotent: it overwrites the target files and keeps the
 * shape that the dispatchers in `tests/mocks/` already expect:
 *   - `detectedFields.ts`       (full captured object — picks the entry with
 *                                the highest field count)
 *   - `detectedLabels.ts`       (full captured object — picks the entry with
 *                                the highest label count)
 *   - `labelValues.ts`          (`{ <labelName>: string[] }`)
 *   - `fieldValues.ts`          (`{ <fieldName>: string[] }`)
 *   - `patterns.ts`             (full captured patterns response)
 *   - `labelsBreakdown.json`    (`{ <refId>: { <byLabel>: { frames, status } } }`)
 *   - `dsQuery.json`            (`Array<{ refId, expr, legendFormat?, response }>`)
 *
 * Service-less captures (no `service_name` in the URL or expression) end up
 * in `tests/mocks/labels/_global/dsQuery.json`. Captured envelopes that hit
 * non-recognised service names get a new folder created on demand.
 */
/* eslint-disable no-console */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Strict equality only: `service_name="foo"` (or backtick-quoted). Regex
 * matchers like `service_name=~"a|b"` aren't matched — they target multiple
 * services and end up in `_global` so we don't pollute the labels/ tree.
 */
const SERVICE_NAME_REGEX = /service_name\s*=\s*["'`]([^"'`]+)["'`]/;

function extractServiceNameFromExpr(expr: string | undefined): string | undefined {
  if (!expr) {
    return undefined;
  }
  return expr.match(SERVICE_NAME_REGEX)?.[1];
}

function extractServiceNameFromUrl(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  for (const value of parsed.searchParams.values()) {
    const match = extractServiceNameFromExpr(value);
    if (match) {
      return match;
    }
  }
  return undefined;
}

type CapturedEntry = {
  url: string;
  request?: unknown;
  response: unknown;
};

type LokiQueryShape = { refId?: string; expr?: string; legendFormat?: string };

type CapturedResponse = { frames: unknown[]; status?: number };

type DsQueryEntry = {
  refId: string;
  expr?: string;
  legendFormat?: string;
  response: CapturedResponse;
};

type LabelsBreakdownFixture = Record<string, Record<string, CapturedResponse>>;

const REPO_ROOT = path.resolve(__dirname, '../../..');
const CAPTURED_DIR = path.join(REPO_ROOT, 'tests/mocks/captured');
const LABELS_DIR = path.join(REPO_ROOT, 'tests/mocks/labels');

/**
 * refIds that drive the labels-breakdown panels (they pivot the same query
 * across every label via `by (X)`). Other refIds go into `dsQuery.json`.
 */
const BREAKDOWN_REFIDS = new Set(['LABEL_BREAKDOWN_VALUES']);

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function readJsonOrEmpty<T>(file: string, fallback: T): T {
  try {
    return readJson<T>(file);
  } catch {
    return fallback;
  }
}

function writeJsonFormatted(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** Compact JSON output (no indentation) — used for large ds/query files. */
function writeJsonCompact(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value)}\n`);
}

function writeTsModule(file: string, contents: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

/**
 * Set of service names the splitter is allowed to write per-service folders
 * for. Anything else (regex selectors, unknown services) goes to `_global` so
 * we don't pollute the labels/ tree with one-off folders like
 * `service_name-tempo-distributor|tempo-ingester`.
 */
const KNOWN_SERVICES = new Set(['tempo-distributor', 'tempo-ingester', 'nginx', 'nginx-json', 'nginx-json-mixed']);

function serviceFolder(serviceName: string): string {
  return path.join(LABELS_DIR, `service_name-${serviceName}`);
}

/** Coerce a raw extracted service name into either a known service or `_global`. */
function bucketize(serviceName: string | undefined): string {
  if (!serviceName) {
    return '_global';
  }
  if (KNOWN_SERVICES.has(serviceName)) {
    return serviceName;
  }
  return '_global';
}

function normalizeExpr(expr: string | undefined): string {
  return (expr ?? '').replace(/\s+/g, ' ').trim();
}

function extractByLabel(expr: string | undefined): string | undefined {
  if (!expr) {
    return undefined;
  }
  return expr.match(/\bby\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/)?.[1];
}

/** Pull `<name>` out of `/resources/label/<name>/values?...`. */
function extractLabelNameFromUrl(url: string): string | undefined {
  try {
    const parts = new URL(url).pathname.split('/');
    const idx = parts.indexOf('label');
    return idx >= 0 ? parts[idx + 1] : undefined;
  } catch {
    return undefined;
  }
}

/** Pull `<name>` out of `/resources/detected_field/<name>/values?...`. */
function extractFieldNameFromUrl(url: string): string | undefined {
  try {
    const parts = new URL(url).pathname.split('/');
    const idx = parts.indexOf('detected_field');
    return idx >= 0 ? parts[idx + 1] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Group entries by service name (extracted from URL). Entries with no
 * service — or with a regex / multi-service selector — land in `_global`.
 */
function groupByService<T extends CapturedEntry>(entries: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const service = bucketize(extractServiceNameFromUrl(entry.url));
    const bucket = groups.get(service) ?? [];
    bucket.push(entry);
    groups.set(service, bucket);
  }
  return groups;
}

/** Pick a representative entry from a list — prefers the one with the most data. */
function pickRichest<T extends CapturedEntry>(entries: T[], score: (entry: T) => number): T | undefined {
  if (entries.length === 0) {
    return undefined;
  }
  let best = entries[0];
  let bestScore = score(best);
  for (let i = 1; i < entries.length; i++) {
    const candidate = entries[i];
    const candidateScore = score(candidate);
    if (candidateScore > bestScore) {
      best = candidate;
      bestScore = candidateScore;
    }
  }
  return best;
}

function arrayLengthOf(obj: unknown, key: string): number {
  if (obj && typeof obj === 'object' && Array.isArray((obj as Record<string, unknown>)[key])) {
    return (obj as Record<string, unknown[]>)[key].length;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Per-endpoint splitters — each takes the captured entries for one service and
// writes the corresponding fixture file in that service's folder.
// ---------------------------------------------------------------------------

function writeDetectedLabels(serviceName: string, entries: CapturedEntry[]) {
  const richest = pickRichest(entries, (e) => arrayLengthOf(e.response, 'detectedLabels'));
  if (!richest) {
    return;
  }
  const file = path.join(serviceFolder(serviceName), 'detectedLabels.ts');
  writeTsModule(
    file,
    `/**
 * Captured \`GET /resources/detected_labels\` response for
 * \`{service_name="${serviceName}"}\`.
 */
export const detectedLabels = ${JSON.stringify(richest.response, null, 2)} as const;
`
  );
}

function writeDetectedFields(serviceName: string, entries: CapturedEntry[]) {
  const richest = pickRichest(entries, (e) => arrayLengthOf(e.response, 'fields'));
  if (!richest) {
    return;
  }
  const file = path.join(serviceFolder(serviceName), 'detectedFields.ts');
  writeTsModule(
    file,
    `/**
 * Captured \`GET /resources/detected_fields\` response for
 * \`{service_name="${serviceName}"}\`.
 */
export const detectedFields = ${JSON.stringify(richest.response, null, 2)} as const;
`
  );
}

function writePatterns(serviceName: string, entries: CapturedEntry[]) {
  const richest = pickRichest(entries, (e) => arrayLengthOf(e.response, 'data'));
  if (!richest) {
    return;
  }
  const file = path.join(serviceFolder(serviceName), 'patterns.ts');
  writeTsModule(
    file,
    `/**
 * Captured \`GET /resources/patterns\` response for
 * \`{service_name="${serviceName}"}\`.
 */
export const patterns = ${JSON.stringify(richest.response, null, 2)} as const;
`
  );
}

function writeLabelValues(serviceName: string, entries: CapturedEntry[]) {
  const map: Record<string, string[]> = {};
  for (const entry of entries) {
    const labelName = extractLabelNameFromUrl(entry.url);
    if (!labelName) {
      continue;
    }
    const data = (entry.response as { data?: unknown })?.data;
    if (Array.isArray(data) && data.every((v): v is string => typeof v === 'string')) {
      // Prefer the larger response (deduplicate via union to be safe across pages).
      const existing = map[labelName];
      map[labelName] = existing ? Array.from(new Set([...existing, ...data])) : data;
    }
  }
  if (Object.keys(map).length === 0) {
    return;
  }
  const file = path.join(serviceFolder(serviceName), 'labelValues.ts');
  writeTsModule(
    file,
    `/**
 * Captured \`GET /resources/label/<name>/values\` responses for
 * \`{service_name="${serviceName}"}\`. Keyed by label name.
 */
export const labelValues: Record<string, string[]> = ${JSON.stringify(map, null, 2)};
`
  );
}

function writeFieldValues(serviceName: string, entries: CapturedEntry[]) {
  const map: Record<string, string[]> = {};
  for (const entry of entries) {
    const fieldName = extractFieldNameFromUrl(entry.url);
    if (!fieldName) {
      continue;
    }
    const values = (entry.response as { values?: unknown })?.values;
    if (Array.isArray(values) && values.every((v): v is string => typeof v === 'string')) {
      const existing = map[fieldName];
      map[fieldName] = existing ? Array.from(new Set([...existing, ...values])) : values;
    }
  }
  if (Object.keys(map).length === 0) {
    return;
  }
  const file = path.join(serviceFolder(serviceName), 'fieldValues.ts');
  writeTsModule(
    file,
    `/**
 * Captured \`GET /resources/detected_field/<name>/values\` responses for
 * \`{service_name="${serviceName}"}\`. Keyed by field name.
 */
export const fieldValues: Record<string, string[]> = ${JSON.stringify(map, null, 2)};
`
  );
}

/**
 * `/ds/query` is special: each captured entry holds many sub-queries (one per
 * `refId`). We flatten them, group by extracted service, then partition each
 * group into:
 *   - `labelsBreakdown.json` — entries whose refId is a known breakdown refId
 *     and whose expression has a `by (<label>)` clause.
 *   - `dsQuery.json`         — everything else (logs panel, ts panels, field
 *                              breakdowns, etc.).
 */
function splitDsQuery(rawEntries: CapturedEntry[]) {
  // Dedupe: same `<service>|<refId>|<normalizedExpr>` only kept once.
  const perService = new Map<string, Map<string, DsQueryEntry>>();
  const breakdownByService = new Map<string, LabelsBreakdownFixture>();
  let totalQueries = 0;
  let droppedDupes = 0;

  for (const entry of rawEntries) {
    const request = entry.request as { queries?: LokiQueryShape[] } | undefined;
    const queries = request?.queries ?? [];
    const responseResults =
      (entry.response as { results?: Record<string, CapturedResponse> } | undefined)?.results ?? {};

    for (const query of queries) {
      totalQueries++;
      const refId = query.refId;
      if (!refId) {
        continue;
      }
      const captured = responseResults[refId];
      if (!captured) {
        continue;
      }
      const serviceName = bucketize(extractServiceNameFromExpr(query.expr));
      const normalizedExpr = normalizeExpr(query.expr);

      if (BREAKDOWN_REFIDS.has(refId)) {
        const byLabel = extractByLabel(query.expr);
        if (byLabel) {
          const breakdown = breakdownByService.get(serviceName) ?? {};
          const refIdBucket = breakdown[refId] ?? {};
          refIdBucket[byLabel] = { frames: captured.frames ?? [], status: captured.status ?? 200 };
          breakdown[refId] = refIdBucket;
          breakdownByService.set(serviceName, breakdown);
          continue;
        }
      }

      const bucket = perService.get(serviceName) ?? new Map<string, DsQueryEntry>();
      const dedupKey = `${refId}|${normalizedExpr}`;
      if (bucket.has(dedupKey)) {
        droppedDupes++;
        continue;
      }
      bucket.set(dedupKey, {
        refId,
        expr: query.expr,
        legendFormat: query.legendFormat,
        response: { frames: captured.frames ?? [], status: captured.status ?? 200 },
      });
      perService.set(serviceName, bucket);
    }
  }

  // Write `dsQuery.json` per service (and `_global`). Compact JSON keeps the
  // file size manageable — these can be 10s of MB when raw frames are big.
  for (const [serviceName, entries] of perService) {
    const dir = serviceName === '_global' ? path.join(LABELS_DIR, '_global') : serviceFolder(serviceName);
    const file = path.join(dir, 'dsQuery.json');
    const arr = Array.from(entries.values());
    writeJsonCompact(file, arr);
    console.log(`[splitCaptured] ds_query: wrote ${arr.length} unique entries → ${path.relative(REPO_ROOT, file)}`);
  }

  // Write `labelsBreakdown.json` per service. Merge with any existing entries
  // so a partial recording doesn't blow away previously captured labels.
  for (const [serviceName, breakdown] of breakdownByService) {
    if (serviceName === '_global') {
      continue;
    }
    const file = path.join(serviceFolder(serviceName), 'labelsBreakdown.json');
    const existing = readJsonOrEmpty<LabelsBreakdownFixture>(file, {});
    for (const [refId, byLabel] of Object.entries(breakdown)) {
      existing[refId] = { ...(existing[refId] ?? {}), ...byLabel };
    }
    writeJsonFormatted(file, existing);
  }

  console.log(`[splitCaptured] ds_query: ${totalQueries} sub-queries, dropped ${droppedDupes} duplicates`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function loadCaptured<T>(fileName: string): T[] {
  const file = path.join(CAPTURED_DIR, fileName);
  return readJsonOrEmpty<T[]>(file, []);
}

function main() {
  const detectedLabels = loadCaptured<CapturedEntry>('detected_labels.json');
  const detectedFields = loadCaptured<CapturedEntry>('detected_fields.json');
  const labelValues = loadCaptured<CapturedEntry>('label_values.json');
  const fieldValues = loadCaptured<CapturedEntry>('detected_field_values.json');
  const patterns = loadCaptured<CapturedEntry>('patterns.json');
  const dsQuery = loadCaptured<CapturedEntry>('ds_query.json');

  const namedEndpoints: Array<[string, CapturedEntry[], (svc: string, entries: CapturedEntry[]) => void]> = [
    ['detected_labels', detectedLabels, writeDetectedLabels],
    ['detected_fields', detectedFields, writeDetectedFields],
    ['patterns', patterns, writePatterns],
    ['label_values', labelValues, writeLabelValues],
    ['detected_field_values', fieldValues, writeFieldValues],
  ];

  for (const [name, entries, writer] of namedEndpoints) {
    if (entries.length === 0) {
      console.log(`[splitCaptured] ${name}: no captures, skipping`);
      continue;
    }
    const groups = groupByService(entries);
    for (const [serviceName, group] of groups) {
      if (serviceName === '_global') {
        // These endpoints don't have a meaningful service-less variant.
        console.log(`[splitCaptured] ${name}: ${group.length} entries with no service_name (skipped)`);
        continue;
      }
      writer(serviceName, group);
      console.log(`[splitCaptured] ${name}: wrote ${group.length} entries → service_name-${serviceName}`);
    }
  }

  if (dsQuery.length === 0) {
    console.log('[splitCaptured] ds_query: no captures, skipping');
  } else {
    splitDsQuery(dsQuery);
    console.log(`[splitCaptured] ds_query: split ${dsQuery.length} envelopes`);
  }

  console.log('[splitCaptured] Done. Run `git status tests/mocks/labels/` to see the diff.');
}

main();
