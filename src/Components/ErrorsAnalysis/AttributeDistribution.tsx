import React, { useCallback, useEffect, useReducer, useState } from 'react';

import { css } from '@emotion/css';
import { DataFrame, DataQueryRequest, dateTime, FieldType, GrafanaTheme2 } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Icon, Spinner, useStyles2 } from '@grafana/ui';
import { lastValueFrom } from 'rxjs';

import { LokiDatasource, LokiQuery } from '../../services/lokiQuery';

// Pretty-name overrides for known Faro fields applied to dynamically detected fields.
// Any field not in this map will display with its raw field name as the label.
// Note: priority attributes defined in ErrorsAnalysis.tsx carry their own labels and
// take precedence -- this map only affects fields that appear outside the priority list.
// Both lists are provisional; see ErrorsAnalysis.tsx comment.
const FARO_LABEL_MAP: Record<string, string> = {
  app_version: 'Version',
  browser_name: 'Browser',
  country_iso: 'Location',
  os_name: 'OS / Device',
  page_id: 'View / Page',
};

// Fields that are not useful for distribution analysis: stream selector
// labels, error-grouping keys, raw log body, high-noise timestamp fields,
// and unique-per-occurrence identifiers.
const FIELDS_TO_EXCLUDE = new Set([
  // Stream selector labels
  'app_id',
  'kind',
  // Error grouping keys
  'attribute_hash',
  'hash',
  // Unique-per-occurrence identifiers (too high cardinality to be useful)
  'app',
  'session_id',
  'trace_id',
  'span_id',
  'user_id',
  // Free-text / high-cardinality content fields
  'stacktrace',
  'value',
  'body',
  'message',
  'msg',
  // Noise / internal fields
  'level',
  'level_extracted',
  'kind_extracted',
  'time',
  'timestamp',
  'ts',
  'tsNs',
]);

const MAX_VALUES_COLLAPSED = 1;
const MAX_VALUES_EXPANDED = 10;

export interface AttributeConfig {
  field: string;
  label: string;
}

interface LabelValueCount {
  value: string;
  count: number;
  percentage: number;
}

interface AttributeState {
  error: boolean;
  expanded: boolean;
  loading: boolean;
  values: LabelValueCount[];
}

interface State {
  attributes: AttributeConfig[];
  data: Record<string, AttributeState>;
  detecting: boolean;
}

type Action =
  | { type: 'DETECTING' }
  | { type: 'SET_ATTRIBUTES'; configs: AttributeConfig[] }
  | { type: 'LOADING'; field: string }
  | { type: 'LOADED'; field: string; values: LabelValueCount[] }
  | { type: 'ERROR'; field: string }
  | { type: 'TOGGLE_EXPANDED'; field: string }
  | { type: 'ADD_ATTRIBUTE'; config: AttributeConfig };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'DETECTING':
      return { ...state, detecting: true };
    case 'SET_ATTRIBUTES': {
      // Preserve user-added attributes not in the detected list
      const detectedFields = new Set(action.configs.map((c) => c.field));
      const userAdded = state.attributes.filter((a) => !detectedFields.has(a.field));
      const merged = [...action.configs, ...userAdded];
      const data: Record<string, AttributeState> = {};
      for (const c of merged) {
        data[c.field] = state.data[c.field] ?? { error: false, expanded: false, loading: true, values: [] };
      }
      return { attributes: merged, data, detecting: false };
    }
    case 'LOADING':
      return {
        ...state,
        data: {
          ...state.data,
          [action.field]: {
            error: false,
            expanded: state.data[action.field]?.expanded ?? false,
            loading: true,
            values: [],
          },
        },
      };
    case 'LOADED':
      return {
        ...state,
        data: {
          ...state.data,
          [action.field]: {
            error: false,
            expanded: state.data[action.field]?.expanded ?? false,
            loading: false,
            values: action.values,
          },
        },
      };
    case 'ERROR':
      return {
        ...state,
        data: {
          ...state.data,
          [action.field]: {
            error: true,
            expanded: state.data[action.field]?.expanded ?? false,
            loading: false,
            values: [],
          },
        },
      };
    case 'TOGGLE_EXPANDED':
      return {
        ...state,
        data: {
          ...state.data,
          [action.field]: {
            ...state.data[action.field],
            expanded: !state.data[action.field]?.expanded,
          },
        },
      };
    case 'ADD_ATTRIBUTE':
      if (state.attributes.some((a) => a.field === action.config.field)) {
        return state;
      }
      return {
        ...state,
        attributes: [...state.attributes, action.config],
        data: {
          ...state.data,
          [action.config.field]: { error: false, expanded: false, loading: true, values: [] },
        },
      };
    default:
      return state;
  }
}

export interface AttributeDistributionProps {
  appId: string;
  datasourceUid: string;
  errorHash: string;
  timeRange: { from: number; to: number };
  onFilterApply?: (label: string, value: string) => void;
  // Priority attributes are pinned to the top of the list, in the order given,
  // before dynamically detected fields. Only priority attributes that are also
  // present in the detected set are shown -- undetected ones are silently dropped.
  // If not provided, detected fields appear in Loki's returned order.
  // The list and its ordering should be defined by the consumer, not this component.
  priorityAttributes?: AttributeConfig[];
  // Optional label displayed at the top of the sidebar to communicate the scope
  // of the dataset to the user. The consumer sets this because it knows what limit
  // its query applies -- the component just renders it.
  // Example values: "Last 1000 logs", "Slowest 1000 traces"
  // Use this whenever the underlying query caps the number of events so users
  // understand the distributions are based on a sample, not the full dataset.
  queryLimitLabel?: string;
}

// Reorders detected attributes so that any fields named in priorityAttributes
// appear first (in priority order), followed by the remaining detected fields.
// Priority attributes not present in the detected set are dropped.
function orderByPriority(detected: AttributeConfig[], priority: AttributeConfig[]): AttributeConfig[] {
  if (!priority.length) {
    return detected;
  }
  const detectedByField = new Map(detected.map((a) => [a.field, a]));
  const priorityFirst = priority.filter((p) => detectedByField.has(p.field));
  const priorityFields = new Set(priorityFirst.map((p) => p.field));
  const rest = detected.filter((a) => !priorityFields.has(a.field));
  return [...priorityFirst, ...rest];
}

function buildErrorStreamSelector(appId: string, errorHash: string): string {
  return `{app_id="${appId}", kind="exception"} | logfmt | attribute_hash="${errorHash}" or hash="${errorHash}"`;
}

function buildDistributionQuery(appId: string, errorHash: string, field: string): string {
  return (
    `sum by (${field}) (` +
    `count_over_time(` +
    `{app_id="${appId}", kind="exception"} | logfmt ` +
    `| attribute_hash="${errorHash}" or hash="${errorHash}" ` +
    `| keep ${field} ` +
    `[$__range]` +
    `))`
  );
}

async function fetchDetectedFields(
  datasourceUid: string,
  appId: string,
  errorHash: string,
  timeRange: { from: number; to: number }
): Promise<AttributeConfig[]> {
  const ds = (await getDataSourceSrv().get(datasourceUid)) as LokiDatasource;
  const query = buildErrorStreamSelector(appId, errorHash);

  const response = (await (ds as any).getResource(
    'detected_fields',
    {
      end: dateTime(timeRange.to).utc().toISOString(),
      query,
      start: dateTime(timeRange.from).utc().toISOString(),
    },
    { requestId: 'errors-detected-fields' }
  )) as { fields?: Array<{ label: string }> };

  return (response.fields ?? [])
    .filter((f: { label: string }) => !FIELDS_TO_EXCLUDE.has(f.label))
    .map((f: { label: string }) => ({
      field: f.label,
      label: FARO_LABEL_MAP[f.label] ?? f.label,
    }));
}

async function fetchLabelDistribution(
  datasourceUid: string,
  appId: string,
  errorHash: string,
  field: string,
  timeRange: { from: number; to: number }
): Promise<LabelValueCount[]> {
  const ds = (await getDataSourceSrv().get(datasourceUid)) as LokiDatasource;
  const rangeSec = Math.max(1, Math.round((timeRange.to - timeRange.from) / 1000));

  const target: LokiQuery = {
    datasource: { type: 'loki', uid: datasourceUid },
    expr: buildDistributionQuery(appId, errorHash, field),
    queryType: 'instant',
    refId: field,
  };

  const request: DataQueryRequest<LokiQuery> = {
    app: 'explore',
    interval: `${rangeSec}s`,
    intervalMs: rangeSec * 1000,
    range: {
      from: dateTime(timeRange.from),
      raw: { from: dateTime(timeRange.from).utc().toISOString(), to: dateTime(timeRange.to).utc().toISOString() },
      to: dateTime(timeRange.to),
    },
    requestId: `errors-breakdown-${field}`,
    scopedVars: {},
    startTime: Date.now(),
    targets: [target],
    timezone: 'browser',
  };

  const response = await lastValueFrom(ds.query(request));

  const counts: Array<{ value: string; count: number }> = [];

  response.data.forEach((frame: DataFrame) => {
    // Loki returns numeric-multi frames in wide format: one row per unique label value.
    // The label values are in a string field named after the queried field.
    // The counts are in the corresponding number field.
    const labelField = frame.fields.find((f) => f.type === FieldType.string && f.name === field);
    const valueField = frame.fields.find((f) => f.type === FieldType.number);

    if (!labelField || !valueField) {
      return;
    }

    function getValue(values: unknown, i: number): unknown {
      if (typeof (values as any)?.get === 'function') {
        return (values as any).get(i);
      }
      return (values as any)[i];
    }

    for (let i = 0; i < frame.length; i++) {
      const labelValue = String(getValue(labelField.values, i) ?? '');
      const count = Number(getValue(valueField.values, i));
      if (labelValue && !isNaN(count) && count > 0) {
        counts.push({ count, value: labelValue });
      }
    }
  });

  const total = counts.reduce((sum, c) => sum + c.count, 0);
  if (total === 0) {
    return [];
  }

  return counts
    .map((c) => ({ ...c, percentage: Math.round((c.count / total) * 100) }))
    .sort((a, b) => b.percentage - a.percentage);
}

export function AttributeDistribution({
  appId,
  datasourceUid,
  errorHash,
  onFilterApply,
  priorityAttributes = [],
  queryLimitLabel,
  timeRange,
}: AttributeDistributionProps) {
  const styles = useStyles2(getStyles);
  const [newFieldInput, setNewFieldInput] = useState('');

  const [state, dispatch] = useReducer(reducer, {
    attributes: [],
    data: {},
    detecting: false,
  });

  const fetchDistributions = useCallback(
    async (attributes: AttributeConfig[]) => {
      if (!attributes.length) {
        return;
      }
      attributes.forEach((attr) => {
        dispatch({ type: 'LOADING', field: attr.field });
      });
      await Promise.allSettled(
        attributes.map(async (attr) => {
          try {
            const values = await fetchLabelDistribution(datasourceUid, appId, errorHash, attr.field, timeRange);
            dispatch({ type: 'LOADED', field: attr.field, values });
          } catch {
            dispatch({ type: 'ERROR', field: attr.field });
          }
        })
      );
    },
    [appId, datasourceUid, errorHash, timeRange]
  );

  useEffect(() => {
    if (!datasourceUid || !appId || !errorHash) {
      return;
    }

    let cancelled = false;

    async function run() {
      dispatch({ type: 'DETECTING' });
      let detected: AttributeConfig[] = [];
      try {
        detected = await fetchDetectedFields(datasourceUid, appId, errorHash, timeRange);
      } catch {
        // fall through with empty list -- user can still add fields manually
      }
      if (cancelled) {
        return;
      }
      const ordered = orderByPriority(detected, priorityAttributes);
      dispatch({ type: 'SET_ATTRIBUTES', configs: ordered });
      fetchDistributions(ordered);
    }

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, errorHash, datasourceUid, timeRange.from, timeRange.to]);

  function handleAddField() {
    const field = newFieldInput.trim();
    if (!field) {
      return;
    }
    const config: AttributeConfig = { field, label: FARO_LABEL_MAP[field] ?? field };
    dispatch({ type: 'ADD_ATTRIBUTE', config });
    setNewFieldInput('');
    fetchDistributions([config]);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Attribute Distribution</div>
        {queryLimitLabel && <div className={styles.queryLimit}>{queryLimitLabel}</div>}
        <div className={styles.description}>
          Distributions highlight which fields differ most between this error group and all other logs. High-delta
          fields may indicate causal factors. Click a value to narrow the error subset.
        </div>
        <div className={styles.description}>
          Add additional fields to explore distributions or correlations, including custom labels.
        </div>
      </div>

      <div className={styles.addField}>
        <input
          className={styles.fieldInput}
          placeholder="Search or select a field"
          value={newFieldInput}
          onChange={(e) => setNewFieldInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
        />
        <button className={styles.addButton} onClick={handleAddField}>
          + Add
        </button>
      </div>

      {state.detecting && (
        <div className={styles.detectingRow}>
          <Spinner size="sm" />
          <span>Discovering fields&hellip;</span>
        </div>
      )}

      {!state.detecting && state.attributes.length === 0 && (
        <div className={styles.emptyState}>No fields detected for this error group.</div>
      )}

      <div className={styles.sections}>
        {state.attributes.map((attr) => {
          const attrState = state.data[attr.field];
          if (!attrState) {
            return null;
          }
          return (
            <AttributeSection
              key={attr.field}
              attrState={attrState}
              config={attr}
              onFilterApply={onFilterApply}
              onToggle={() => dispatch({ type: 'TOGGLE_EXPANDED', field: attr.field })}
            />
          );
        })}
      </div>
    </div>
  );
}

interface AttributeSectionProps {
  attrState: AttributeState;
  config: AttributeConfig;
  onFilterApply?: (label: string, value: string) => void;
  onToggle: () => void;
}

function AttributeSection({ attrState, config, onFilterApply, onToggle }: AttributeSectionProps) {
  const styles = useStyles2(getStyles);
  const { error, expanded, loading, values } = attrState;

  const visibleValues = expanded ? values.slice(0, MAX_VALUES_EXPANDED) : values.slice(0, MAX_VALUES_COLLAPSED);
  const hasMore = values.length > MAX_VALUES_EXPANDED;

  return (
    <div className={styles.section}>
      <button className={styles.sectionHeader} onClick={onToggle}>
        <span className={styles.sectionLabel}>{config.label}</span>
        <Icon name={expanded ? 'angle-up' : 'angle-down'} size="sm" />
      </button>

      {loading && (
        <div className={styles.loadingRow}>
          <Spinner size="sm" />
        </div>
      )}

      {!loading && error && <div className={styles.emptyRow}>No data</div>}

      {!loading &&
        !error &&
        visibleValues.map((item) => (
          <button
            key={item.value}
            className={styles.valueRow}
            onClick={() => onFilterApply?.(config.field, item.value)}
          >
            <span className={styles.valueLabel} title={item.value}>
              {item.value}
            </span>
            <div className={styles.barWrapper}>
              <div className={styles.bar} style={{ width: `${item.percentage}%` }} />
            </div>
            <span className={styles.percentage}>{item.percentage}%</span>
          </button>
        ))}

      {!loading && !error && values.length === 0 && <div className={styles.emptyRow}>No values found</div>}

      {expanded && hasMore && (
        <button className={styles.showAllButton} onClick={(e) => e.stopPropagation()}>
          Show all
        </button>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  addButton: css({
    background: 'none',
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(0.5, 1),
    whiteSpace: 'nowrap',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  addField: css({
    display: 'flex',
    gap: theme.spacing(1),
  }),
  queryLimit: css({
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(0.5, 1),
  }),
  bar: css({
    background: theme.colors.warning.main,
    borderRadius: theme.shape.radius.default,
    height: '100%',
    transition: 'width 0.3s ease',
  }),
  barWrapper: css({
    background: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
    flex: 1,
    height: '6px',
    overflow: 'hidden',
  }),
  container: css({
    backgroundColor: theme.colors.background.secondary,
    borderRight: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    height: '100%',
    overflowY: 'auto',
    padding: theme.spacing(2),
  }),
  description: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.4,
  }),
  detectingRow: css({
    alignItems: 'center',
    color: theme.colors.text.secondary,
    display: 'flex',
    fontSize: theme.typography.bodySmall.fontSize,
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
  }),
  emptyRow: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontStyle: 'italic',
    padding: theme.spacing(0.5, 0.5),
  }),
  emptyState: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontStyle: 'italic',
    padding: theme.spacing(1, 0),
  }),
  fieldInput: css({
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    flex: 1,
    fontSize: theme.typography.bodySmall.fontSize,
    outline: 'none',
    padding: theme.spacing(0.5, 1),
    '&::placeholder': {
      color: theme.colors.text.disabled,
    },
    '&:focus': {
      borderColor: theme.colors.primary.border,
    },
  }),
  header: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  }),
  loadingRow: css({
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(1, 0),
  }),
  percentage: css({
    color: theme.colors.text.secondary,
    flex: '0 0 auto',
    fontSize: theme.typography.bodySmall.fontSize,
    minWidth: '32px',
    textAlign: 'right',
  }),
  section: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  sectionHeader: css({
    alignItems: 'center',
    background: 'none',
    border: 'none',
    borderTop: `1px solid ${theme.colors.border.weak}`,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    justifyContent: 'space-between',
    padding: theme.spacing(0.75, 0),
    textAlign: 'left',
    width: '100%',
    '&:hover': {
      color: theme.colors.text.maxContrast,
    },
  }),
  sectionLabel: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  sections: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  showAllButton: css({
    background: 'none',
    border: 'none',
    color: theme.colors.text.link,
    cursor: 'pointer',
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(0.5, 0.5),
    textAlign: 'left',
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
  title: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.h6.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  valueLabel: css({
    flex: '0 0 auto',
    maxWidth: '40%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  valueRow: css({
    alignItems: 'center',
    background: 'none',
    border: 'none',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    fontSize: theme.typography.bodySmall.fontSize,
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0.5),
    textAlign: 'left',
    width: '100%',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
});
