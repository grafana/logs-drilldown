import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { cx } from '@emotion/css';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Spinner, useStyles2 } from '@grafana/ui';

const MAX_VALUES_COLLAPSED = 1;
const MAX_VALUES_EXPANDED = 10;

export interface AttributeConfig {
  field: string;
  label: string;
}

export interface LabelValueCount {
  value: string;
  count: number;
  percentage: number;
}

// The slice of state the component needs to fetch data.
// The consumer builds this from its own datasource + query knowledge.
export interface DatasetContext {
  datasourceUid: string;
  query: string;
  timeRange: { from: number; to: number };
}

export interface ActiveFilter {
  field: string;
  value: string;
}

// A value entry extended with a `retained` flag used for the sticky values pattern.
interface DisplayValue extends LabelValueCount {
  // True for values from the pre-filter snapshot that are absent from the current
  // filtered distribution. Shown at 0% and dimmed so the user can still see and
  // interact with them after filtering narrows the result set.
  retained: boolean;
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
  selectedFilters: ActiveFilter[];
  // Snapshot of value lists per field, taken the moment the first filter is applied.
  // Retained until all filters are cleared. null when no filters are active.
  valueSnapshot: Record<string, LabelValueCount[]> | null;
}

type Action =
  | { type: 'DETECTING' }
  | { type: 'SET_ATTRIBUTES'; configs: AttributeConfig[] }
  | { type: 'LOADING'; field: string }
  | { type: 'LOADED'; field: string; values: LabelValueCount[] }
  | { type: 'ERROR'; field: string }
  | { type: 'TOGGLE_EXPANDED'; field: string }
  | { type: 'ADD_ATTRIBUTE'; config: AttributeConfig }
  | { type: 'TOGGLE_FILTER'; field: string; value: string }
  | { type: 'CLEAR_FILTERS' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'DETECTING':
      return { ...state, detecting: true };
    case 'SET_ATTRIBUTES': {
      const detectedFields = new Set(action.configs.map((c) => c.field));
      const userAdded = state.attributes.filter((a) => !detectedFields.has(a.field));
      const merged = [...action.configs, ...userAdded];
      const data: Record<string, AttributeState> = {};
      for (const c of merged) {
        data[c.field] = state.data[c.field] ?? { error: false, expanded: false, loading: true, values: [] };
      }
      return { ...state, attributes: merged, data, detecting: false };
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
    case 'TOGGLE_FILTER': {
      const { field, value } = action;
      const isRemoving = state.selectedFilters.some((f) => f.field === field && f.value === value);
      const newFilters = isRemoving
        ? state.selectedFilters.filter((f) => !(f.field === field && f.value === value))
        : [...state.selectedFilters, { field, value }];

      // Take a snapshot of current values when the first filter is added.
      // This snapshot is used to retain values that drop to 0% after filtering.
      let { valueSnapshot } = state;
      if (!isRemoving && state.selectedFilters.length === 0) {
        valueSnapshot = {};
        for (const [f, attrState] of Object.entries(state.data)) {
          valueSnapshot[f] = attrState.values;
        }
      }
      // Release the snapshot when the last filter is removed.
      if (isRemoving && newFilters.length === 0) {
        valueSnapshot = null;
      }

      return { ...state, selectedFilters: newFilters, valueSnapshot };
    }
    case 'CLEAR_FILTERS':
      return { ...state, selectedFilters: [], valueSnapshot: null };
    default:
      return state;
  }
}

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

// Escapes special RE2 regex characters in a literal value string.
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Appends LogQL filter pipeline stages for active filters to the base query.
// Multiple values for the same field are combined as OR using regex match.
// Filters across different fields stack as AND (separate pipeline stages).
function buildEffectiveQuery(baseQuery: string, filters: ActiveFilter[]): string {
  if (!filters.length) {
    return baseQuery;
  }

  const byField = new Map<string, string[]>();
  for (const { field, value } of filters) {
    if (!byField.has(field)) {
      byField.set(field, []);
    }
    byField.get(field)!.push(value);
  }

  let q = baseQuery;
  for (const [field, values] of byField) {
    if (values.length === 1) {
      q += ` | ${field}="${values[0]}"`;
    } else {
      const pattern = values.map(escapeRegex).join('|');
      q += ` | ${field}=~"${pattern}"`;
    }
  }
  return q;
}

// Merges current distribution values with snapshot values.
// Values in the snapshot but absent from current results are appended at 0%
// and marked retained -- they remain visible and selectable after filtering.
function mergeWithSnapshot(current: LabelValueCount[], snapshot: LabelValueCount[] | null): DisplayValue[] {
  if (!snapshot) {
    return current.map((v) => ({ ...v, retained: false }));
  }
  const currentByValue = new Map(current.map((v) => [v.value, v]));
  const result: DisplayValue[] = current.map((v) => ({ ...v, retained: false }));
  for (const snap of snapshot) {
    if (!currentByValue.has(snap.value)) {
      result.push({ value: snap.value, count: 0, percentage: 0, retained: true });
    }
  }
  return result;
}

export interface AttributeDistributionProps {
  context: DatasetContext;
  // Adapter function -- provided by the consumer. Returns detected fields for
  // the given context. The consumer is responsible for filtering, label mapping,
  // and any dataset-specific field discovery logic.
  fetchAttributes: (context: DatasetContext) => Promise<AttributeConfig[]>;
  // Adapter function -- provided by the consumer. Returns value counts for a
  // single field within the dataset described by context.
  fetchDistribution: (context: DatasetContext, field: string) => Promise<LabelValueCount[]>;
  // Called whenever the active filter set changes. The consumer can use this
  // to update other panels on the page. Filter state is owned by this component
  // and is scoped to its lifetime -- no persistent writes are made externally.
  onFiltersChange?: (filters: ActiveFilter[]) => void;
  // Priority attributes are pinned to the top of the list, in the order given,
  // before dynamically detected fields. Only priority attributes that are also
  // present in the detected set are shown -- undetected ones are silently dropped.
  // If not provided, detected fields appear in the order returned by fetchAttributes.
  // The list and its ordering should be defined by the consumer, not this component.
  priorityAttributes?: AttributeConfig[];
  // Optional label displayed at the top of the sidebar to communicate the scope
  // of the dataset to the user. The consumer sets this because it knows what limit
  // its query applies -- the component just renders it.
  // Example values: "Last 1000 logs", "Slowest 1000 traces"
  queryLimitLabel?: string;
  // Seed value for the selectedFilters reducer state, applied only on first mount.
  // The consumer passes its last-known filter set so that if the component remounts
  // (e.g. due to React strict mode or Scenes re-activation), chips reappear
  // immediately without the user needing to re-apply them.
  initialSelectedFilters?: ActiveFilter[];
}

export function AttributeDistribution({
  context,
  fetchAttributes,
  fetchDistribution,
  onFiltersChange,
  priorityAttributes = [],
  queryLimitLabel,
  initialSelectedFilters,
}: AttributeDistributionProps) {
  const styles = useStyles2(getStyles);
  const [newFieldInput, setNewFieldInput] = useState('');

  const [state, dispatch] = useReducer(
    reducer,
    initialSelectedFilters ?? [],
    (initFilters): State => ({
      attributes: [],
      data: {},
      detecting: false,
      selectedFilters: initFilters,
      valueSnapshot: null,
    })
  );

  // Always-current ref so that the initial-load effect can build the effective
  // query without adding selectedFilters to its deps (which would cause
  // redistribution fetches on every filter toggle, handled separately).
  const selectedFiltersRef = useRef(state.selectedFilters);
  selectedFiltersRef.current = state.selectedFilters;

  const loadDistributions = useCallback(
    async (attributes: AttributeConfig[], ctx: DatasetContext) => {
      if (!attributes.length) {
        return;
      }
      attributes.forEach((attr) => {
        dispatch({ type: 'LOADING', field: attr.field });
      });
      await Promise.allSettled(
        attributes.map(async (attr) => {
          try {
            const values = await fetchDistribution(ctx, attr.field);
            dispatch({ type: 'LOADED', field: attr.field, values });
          } catch {
            dispatch({ type: 'ERROR', field: attr.field });
          }
        })
      );
    },
    // fetchDistribution is a stable module-level function passed from the adapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (!context.datasourceUid || !context.query) {
      return;
    }

    let cancelled = false;

    async function run() {
      dispatch({ type: 'DETECTING' });
      let detected: AttributeConfig[] = [];
      try {
        detected = await fetchAttributes(context);
      } catch {
        // fall through with empty list -- user can still add fields manually
      }
      if (cancelled) {
        return;
      }
      const ordered = orderByPriority(detected, priorityAttributes);
      dispatch({ type: 'SET_ATTRIBUTES', configs: ordered });
      const activeFilters = selectedFiltersRef.current;
      const effectiveContext =
        activeFilters.length > 0
          ? { ...context, query: buildEffectiveQuery(context.query, activeFilters) }
          : context;
      loadDistributions(ordered, effectiveContext);
    }

    run();

    return () => {
      cancelled = true;
    };
    // fetchAttributes is a stable module-level function; context fields and
    // priorityAttributes are the true dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.query, context.datasourceUid, context.timeRange.from, context.timeRange.to, priorityAttributes]);

  function handleToggleFilter(field: string, value: string) {
    const isRemoving = state.selectedFilters.some((f) => f.field === field && f.value === value);
    const newFilters = isRemoving
      ? state.selectedFilters.filter((f) => !(f.field === field && f.value === value))
      : [...state.selectedFilters, { field, value }];

    dispatch({ type: 'TOGGLE_FILTER', field, value });

    const effectiveContext = { ...context, query: buildEffectiveQuery(context.query, newFilters) };
    loadDistributions(state.attributes, effectiveContext);
    onFiltersChange?.(newFilters);
  }

  function handleClearFilters() {
    dispatch({ type: 'CLEAR_FILTERS' });
    loadDistributions(state.attributes, context);
    onFiltersChange?.([]);
  }

  function handleAddField() {
    const field = newFieldInput.trim();
    if (!field) {
      return;
    }
    // Use the raw field name as the label -- the consumer's label mapping only
    // applies to the detected field list returned by fetchAttributes.
    const config: AttributeConfig = { field, label: field };
    dispatch({ type: 'ADD_ATTRIBUTE', config });
    setNewFieldInput('');
    const effectiveContext = { ...context, query: buildEffectiveQuery(context.query, state.selectedFilters) };
    loadDistributions([config], effectiveContext);
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

      {state.selectedFilters.length > 0 && (
        <div className={styles.filterChips}>
          {state.selectedFilters.map(({ field, value }) => (
            <div key={`${field}=${value}`} className={styles.chip}>
              <span className={styles.chipText}>
                {field} = {value}
              </span>
              <button
                aria-label={`Remove filter ${field} = ${value}`}
                className={styles.chipRemove}
                onClick={() => handleToggleFilter(field, value)}
              >
                <Icon name="times" size="xs" />
              </button>
            </div>
          ))}
          <button className={styles.clearAll} onClick={handleClearFilters}>
            Clear all
          </button>
        </div>
      )}

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
          const selectedValues = new Set(
            state.selectedFilters.filter((f) => f.field === attr.field).map((f) => f.value)
          );
          const snapshotValues = state.valueSnapshot?.[attr.field] ?? null;
          return (
            <AttributeSection
              key={attr.field}
              attrState={attrState}
              config={attr}
              selectedValues={selectedValues}
              snapshotValues={snapshotValues}
              onToggleFilter={(value) => handleToggleFilter(attr.field, value)}
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
  selectedValues: Set<string>;
  snapshotValues: LabelValueCount[] | null;
  onToggleFilter: (value: string) => void;
  onToggle: () => void;
}

function AttributeSection({
  attrState,
  config,
  selectedValues,
  snapshotValues,
  onToggleFilter,
  onToggle,
}: AttributeSectionProps) {
  const styles = useStyles2(getStyles);
  const { error, expanded, loading, values } = attrState;

  const allValues = mergeWithSnapshot(values, snapshotValues);
  const visibleValues = expanded ? allValues.slice(0, MAX_VALUES_EXPANDED) : allValues.slice(0, MAX_VALUES_COLLAPSED);
  const hasMore = allValues.length > MAX_VALUES_EXPANDED;

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
        visibleValues.map((item) => {
          const isSelected = selectedValues.has(item.value);
          return (
            <button
              key={item.value}
              className={cx(
                styles.valueRow,
                isSelected && styles.valueRowSelected,
                item.retained && styles.valueRowRetained
              )}
              onClick={() => onToggleFilter(item.value)}
            >
              <span className={styles.valueLabel} title={item.value}>
                {item.value}
              </span>
              <div className={styles.barWrapper}>
                <div className={styles.bar} style={{ width: `${item.percentage}%` }} />
              </div>
              <span className={styles.percentage}>{item.percentage}%</span>
              {isSelected && <Icon name="check" size="xs" />}
            </button>
          );
        })}

      {!loading && !error && allValues.length === 0 && <div className={styles.emptyRow}>No values found</div>}

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
  chip: css({
    alignItems: 'center',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.primary.border}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    display: 'flex',
    fontSize: theme.typography.bodySmall.fontSize,
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 0.5),
  }),
  chipRemove: css({
    alignItems: 'center',
    background: 'none',
    border: 'none',
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    display: 'flex',
    padding: 0,
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  chipText: css({
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  clearAll: css({
    background: 'none',
    border: 'none',
    color: theme.colors.text.link,
    cursor: 'pointer',
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(0.25, 0),
    '&:hover': {
      textDecoration: 'underline',
    },
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
  filterChips: css({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
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
  queryLimit: css({
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(0.5, 1),
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
  valueRowRetained: css({
    opacity: 0.45,
  }),
  valueRowSelected: css({
    background: theme.colors.action.selected,
    '&:hover': {
      background: theme.colors.action.selected,
    },
  }),
});
