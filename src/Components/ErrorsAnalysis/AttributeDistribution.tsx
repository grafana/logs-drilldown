import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Spinner, useStyles2 } from '@grafana/ui';

const MAX_VALUES_COLLAPSED = 1;
const MAX_VALUES_EXPANDED = 10;

export interface AttributeConfig {
  field: string;
  label: string;
}

export interface LabelValueCount {
  count: number;
  percentage: number;
  value: string;
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
  operator: '!=' | '=';
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
  | { configs: AttributeConfig[]; type: 'SET_ATTRIBUTES' }
  | { field: string; type: 'LOADING' }
  | { field: string; type: 'LOADED'; values: LabelValueCount[] }
  | { field: string; type: 'ERROR' }
  | { field: string; type: 'TOGGLE_EXPANDED' }
  | { config: AttributeConfig; type: 'ADD_ATTRIBUTE' }
  | { field: string; operator: '!=' | '='; type: 'TOGGLE_FILTER'; value: string }
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
      const { field, value, operator } = action;
      const existingIndex = state.selectedFilters.findIndex((f) => f.field === field && f.value === value);
      const existingForField = state.selectedFilters.find((f) => f.field === field);

      let newFilters: ActiveFilter[];
      if (existingIndex >= 0 && state.selectedFilters[existingIndex].operator === operator) {
        // Same operator -- deselect
        newFilters = state.selectedFilters.filter((_, i) => i !== existingIndex);
      } else if (existingIndex >= 0) {
        // Operator switch for this value -- replace in place
        newFilters = state.selectedFilters.map((f, i) => (i === existingIndex ? { ...f, operator } : f));
      } else if (existingForField && existingForField.operator !== operator) {
        // Different operator already active for this field -- clear field and add new
        newFilters = [...state.selectedFilters.filter((f) => f.field !== field), { field, value, operator }];
      } else {
        newFilters = [...state.selectedFilters, { field, value, operator }];
      }

      // Take a snapshot of current values when the first filter is added.
      let { valueSnapshot } = state;
      if (state.selectedFilters.length === 0 && newFilters.length > 0) {
        valueSnapshot = {};
        for (const [f, attrState] of Object.entries(state.data)) {
          valueSnapshot[f] = attrState.values;
        }
      }
      if (newFilters.length === 0) {
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
  // Always include all priority attributes. Use the detected version if present
  // (it carries the label from the consumer's labelMap); otherwise use the priority
  // config directly so the section still appears even when the field is absent from
  // detected_fields for this error group.
  const priorityFirst = priority.map((p) => detectedByField.get(p.field) ?? p);
  const priorityFields = new Set(priority.map((p) => p.field));
  const rest = detected.filter((a) => !priorityFields.has(a.field));
  return [...priorityFirst, ...rest];
}

// Escapes special RE2 regex characters in a literal value string.
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Appends LogQL filter pipeline stages for active filters to the base query.
// Multiple values for the same field and operator are combined via regex (=~ / !~).
// Filters across different fields stack as AND (separate pipeline stages).
function buildEffectiveQuery(baseQuery: string, filters: ActiveFilter[]): string {
  if (!filters.length) {
    return baseQuery;
  }

  // Group by field -- per-field operator is uniform (enforced by the reducer).
  const byField = new Map<string, { operator: '!=' | '='; values: string[] }>();
  for (const { field, value, operator } of filters) {
    const existing = byField.get(field);
    if (existing) {
      existing.values.push(value);
    } else {
      byField.set(field, { operator, values: [value] });
    }
  }

  let q = baseQuery;
  for (const [field, { operator, values }] of byField) {
    if (values.length === 1) {
      q += ` | ${field}${operator}"${values[0]}"`;
    } else {
      const regexOp = operator === '=' ? '=~' : '!~';
      const pattern = values.map(escapeRegex).join('|');
      q += ` | ${field}${regexOp}"${pattern}"`;
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
  // Seed value for the selectedFilters reducer state, applied only on first mount.
  // The consumer passes its last-known filter set so that if the component remounts
  // (e.g. due to React strict mode or Scenes re-activation), chips reappear
  // immediately without the user needing to re-apply them.
  initialSelectedFilters?: ActiveFilter[];
  // Called whenever the active filter set changes. The consumer can use this
  // to update other panels on the page. Filter state is owned by this component.
  // Persistence is consumer-controlled: in app-o11y-kwl this writes to ${Filters}
  // so filters persist across navigation. Consumers that want ephemeral filters
  // simply do not wire this to any persistent store.
  onFiltersChange?: (filters: ActiveFilter[]) => void;
  // Priority attributes are pinned to the top of the list, in the order given,
  // before dynamically detected fields. Priority attributes not present in the
  // detected set are still shown -- absence is itself informative.
  // If not provided, detected fields appear in the order returned by fetchAttributes.
  // The list and its ordering should be defined by the consumer, not this component.
  priorityAttributes?: AttributeConfig[];
  // Optional label displayed at the top of the sidebar to communicate the scope
  // of the dataset to the user. The consumer sets this because it knows what limit
  // its query applies -- the component just renders it.
  // Example values: "Last 1000 logs", "Slowest 1000 traces"
  queryLimitLabel?: string;
  // Optional link to view all logs in an external view. The consumer builds and
  // owns this href -- this component renders it verbatim. When using a plugin
  // extension link (e.g. usePluginLinks with ExploreToolbarAction), the query
  // passed in the extension context must be parsable by the link extension's
  // contextToLink function. Queries with OR conditions (e.g. LogQL field
  // filters joined by "or") are not supported by contextToLink -- they get
  // flattened to AND in the URL and return no results. Simplify the context
  // query to a stream-selector-only expression in that case.
  // title comes from the extension (e.g. "Open in Grafana Logs Drilldown").
  showAllLink?: { href: string; title: string };
}

export function AttributeDistribution({
  context,
  fetchAttributes,
  fetchDistribution,
  initialSelectedFilters,
  onFiltersChange,
  priorityAttributes = [],
  queryLimitLabel,
  showAllLink,
}: AttributeDistributionProps) {
  const styles = useStyles2(getStyles);
  const [newFieldInput, setNewFieldInput] = useState('');
  const [extraFieldsShown, setExtraFieldsShown] = useState(0);

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

  function handleToggleFilter(field: string, value: string, operator: '!=' | '=') {
    // Mirror the reducer logic to compute newFilters synchronously for callbacks.
    const existingIndex = state.selectedFilters.findIndex((f) => f.field === field && f.value === value);
    const existingForField = state.selectedFilters.find((f) => f.field === field);

    let newFilters: ActiveFilter[];
    if (existingIndex >= 0 && state.selectedFilters[existingIndex].operator === operator) {
      newFilters = state.selectedFilters.filter((_, i) => i !== existingIndex);
    } else if (existingIndex >= 0) {
      newFilters = state.selectedFilters.map((f, i) => (i === existingIndex ? { ...f, operator } : f));
    } else if (existingForField && existingForField.operator !== operator) {
      newFilters = [...state.selectedFilters.filter((f) => f.field !== field), { field, value, operator }];
    } else {
      newFilters = [...state.selectedFilters, { field, value, operator }];
    }

    dispatch({ type: 'TOGGLE_FILTER', field, value, operator });

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

  const priorityFieldSet = new Set(priorityAttributes.map((p) => p.field));
  const nonPriorityAttributes = state.attributes.filter((a) => !priorityFieldSet.has(a.field));
  // Only split if there are both priority and non-priority fields. If no priority
  // attributes are configured, all fields are shown without a button.
  const hasSplit = priorityFieldSet.size > 0 && nonPriorityAttributes.length > 0;
  const priorityAttributes_ = hasSplit ? state.attributes.filter((a) => priorityFieldSet.has(a.field)) : state.attributes;
  const visibleNonPriority = nonPriorityAttributes.slice(0, extraFieldsShown);
  const visibleAttributes = hasSplit ? [...priorityAttributes_, ...visibleNonPriority] : state.attributes;
  const remainingCount = nonPriorityAttributes.length - extraFieldsShown;
  const nextBatch = Math.min(10, remainingCount);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>{t('errors-analysis.title', 'Attribute Distribution')}</div>
        {queryLimitLabel && <div className={styles.queryLimit}>{queryLimitLabel}</div>}
        <div className={styles.description}>
          {t(
            'errors-analysis.description-distributions',
            'Distributions highlight which fields differ most between this error group and all other logs. High-delta fields may indicate causal factors. Click a value to narrow the error subset.'
          )}
        </div>
        <div className={styles.description}>
          {t(
            'errors-analysis.description-add-fields',
            'Add additional fields to explore distributions or correlations, including custom labels.'
          )}
        </div>
      </div>

      {state.selectedFilters.length > 0 && (
        <div className={styles.filterChips}>
          {state.selectedFilters.map(({ field, value, operator }) => (
            <div key={`${field}${operator}${value}`} className={styles.chip}>
              <span className={styles.chipText}>
                {field} {operator} {value}
              </span>
              <button
                aria-label={`Remove filter ${field} ${operator} ${value}`}
                className={styles.chipRemove}
                onClick={() => handleToggleFilter(field, value, operator)}
              >
                <Icon name="times" size="xs" />
              </button>
            </div>
          ))}
          <button className={styles.clearAll} onClick={handleClearFilters}>
            {t('errors-analysis.clear-all', 'Clear all')}
          </button>
        </div>
      )}

      <div className={styles.addField}>
        <input
          className={styles.fieldInput}
          placeholder={t('errors-analysis.field-input-placeholder', 'Search or select a field')}
          value={newFieldInput}
          onChange={(e) => setNewFieldInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
        />
        <button className={styles.addButton} onClick={handleAddField}>
          {t('errors-analysis.add-field-button', '+ Add')}
        </button>
      </div>

      {state.detecting && (
        <div className={styles.detectingRow}>
          <Spinner size="sm" />
          <span>{t('errors-analysis.discovering-fields', 'Discovering fields\u2026')}</span>
        </div>
      )}

      {!state.detecting && state.attributes.length === 0 && (
        <div className={styles.emptyState}>{t('errors-analysis.no-fields-detected', 'No fields detected for this error group.')}</div>
      )}

      <div className={styles.sections}>
        {visibleAttributes.map((attr) => {
          const attrState = state.data[attr.field];
          if (!attrState) {
            return null;
          }
          const fieldFilters = state.selectedFilters.filter((f) => f.field === attr.field);
          const includedValues = new Set(fieldFilters.filter((f) => f.operator === '=').map((f) => f.value));
          const excludedValues = new Set(fieldFilters.filter((f) => f.operator === '!=').map((f) => f.value));
          const snapshotValues = state.valueSnapshot?.[attr.field] ?? null;
          return (
            <AttributeSection
              key={attr.field}
              attrState={attrState}
              config={attr}
              includedValues={includedValues}
              excludedValues={excludedValues}
              snapshotValues={snapshotValues}
              onToggleFilter={(value, operator) => handleToggleFilter(attr.field, value, operator)}
              onToggle={() => dispatch({ type: 'TOGGLE_EXPANDED', field: attr.field })}
            />
          );
        })}
        {(hasSplit && (extraFieldsShown > 0 || remainingCount > 0)) || showAllLink ? (
          <div className={styles.showMoreFields}>
            {hasSplit && (extraFieldsShown > 0 || remainingCount > 0) && (
              <>
                <button
                  aria-label={t('errors-analysis.show-more-fields', 'Show {{count}} more fields', { count: nextBatch })}
                  className={cx(styles.showMoreButton, remainingCount === 0 && styles.showMoreButtonDisabled)}
                  disabled={remainingCount === 0}
                  title={remainingCount === 0 ? t('errors-analysis.no-more-fields', 'No more fields') : t('errors-analysis.show-more-fields', 'Show {{count}} more fields', { count: nextBatch })}
                  onClick={() => setExtraFieldsShown(extraFieldsShown + nextBatch)}
                >
                  <Icon name="angle-down" size="sm" />
                </button>
                <button
                  aria-label={t('errors-analysis.collapse-extra-fields', 'Collapse extra fields')}
                  className={cx(styles.showMoreButton, extraFieldsShown === 0 && styles.showMoreButtonDisabled)}
                  disabled={extraFieldsShown === 0}
                  title={extraFieldsShown === 0 ? t('errors-analysis.no-extra-fields-shown', 'No extra fields shown') : t('errors-analysis.collapse-extra-fields', 'Collapse extra fields')}
                  onClick={() => setExtraFieldsShown(0)}
                >
                  <Icon name="angle-up" size="sm" />
                </button>
              </>
            )}
            {showAllLink && (
              <a className={styles.showAllLink} href={showAllLink.href} rel="noreferrer" target="_blank">
                {showAllLink.title}
              </a>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface AttributeSectionProps {
  attrState: AttributeState;
  config: AttributeConfig;
  excludedValues: Set<string>;
  includedValues: Set<string>;
  onToggle: () => void;
  onToggleFilter: (value: string, operator: '!=' | '=') => void;
  snapshotValues: LabelValueCount[] | null;
}

function AttributeSection({
  attrState,
  config,
  includedValues,
  excludedValues,
  snapshotValues,
  onToggleFilter,
  onToggle,
}: AttributeSectionProps) {
  const styles = useStyles2(getStyles);
  const { error, expanded, loading, values } = attrState;

  const allValues = mergeWithSnapshot(values, snapshotValues);
  const visibleValues = expanded ? allValues.slice(0, MAX_VALUES_EXPANDED) : allValues.slice(0, MAX_VALUES_COLLAPSED);
  const hasMore = allValues.length > MAX_VALUES_EXPANDED;
  const isExpandable = allValues.length > MAX_VALUES_COLLAPSED;

  return (
    <div className={styles.section}>
      <button className={styles.sectionHeader} onClick={isExpandable ? onToggle : undefined}>
        <span className={styles.sectionLabel}>{config.label}</span>
        {isExpandable && <Icon name={expanded ? 'angle-up' : 'angle-down'} size="sm" />}
      </button>

      {loading && (
        <div className={styles.loadingRow}>
          <Spinner size="sm" />
        </div>
      )}

      {!loading && error && <div className={styles.emptyRow}>{t('errors-analysis.no-data', 'No data')}</div>}

      {!loading &&
        !error &&
        visibleValues.map((item) => {
          const isIncluded = includedValues.has(item.value);
          const isExcluded = excludedValues.has(item.value);
          const isSelected = isIncluded || isExcluded;
          return (
            <div
              key={item.value}
              className={cx(
                styles.valueRow,
                isSelected && styles.valueRowSelected,
                item.retained && styles.valueRowRetained
              )}
            >
              <span className={styles.valueLabel} title={item.value}>
                {item.value}
              </span>
              <div className={styles.barWrapper}>
                <div className={styles.bar} style={{ width: `${item.percentage}%` }} />
              </div>
              <span className={styles.percentage}>{`${item.percentage}%`}</span>
              <div className={styles.filterButtons}>
                <button
                  aria-label={`Include ${item.value}`}
                  className={cx(styles.filterButton, isIncluded && styles.filterButtonActive)}
                  onClick={() => onToggleFilter(item.value, '=')}
                >
                  {t('errors-analysis.include-filter-button', '+')}
                </button>
                <button
                  aria-label={`Exclude ${item.value}`}
                  className={cx(styles.filterButton, isExcluded && styles.filterButtonActive)}
                  onClick={() => onToggleFilter(item.value, '!=')}
                >
                  {'\u2212'}
                </button>
              </div>
            </div>
          );
        })}

      {!loading && !error && allValues.length === 0 && <div className={styles.emptyRow}>{t('errors-analysis.no-values-found', 'No values found')}</div>}

      {expanded && hasMore && (
        <button className={styles.showAllButton} onClick={(e) => e.stopPropagation()}>
          {t('errors-analysis.show-all-button', 'Show all')}
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
    background: theme.colors.primary.main,
    opacity: 0.5,
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
  filterButtons: css({
    display: 'flex',
    flexShrink: 0,
    gap: 2,
  }),
  filterButton: css({
    alignItems: 'center',
    background: 'none',
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    display: 'flex',
    fontSize: theme.typography.bodySmall.fontSize,
    height: 18,
    justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
    width: 18,
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
  }),
  filterButtonActive: css({
    background: theme.colors.primary.transparent,
    borderColor: theme.colors.primary.border,
    color: theme.colors.primary.text,
    '&:hover': {
      background: theme.colors.primary.transparent,
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
  showMoreFields: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 0),
  }),
  showMoreButton: css({
    alignItems: 'center',
    background: 'none',
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    display: 'flex',
    height: 20,
    justifyContent: 'center',
    padding: 0,
    width: 20,
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
  }),
  showMoreButtonDisabled: css({
    cursor: 'not-allowed',
    opacity: 0.3,
    '&:hover': {
      background: 'none',
      color: theme.colors.text.secondary,
    },
  }),
  showAllLink: css({
    color: theme.colors.text.link,
    fontSize: theme.typography.bodySmall.fontSize,
    marginLeft: 'auto',
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
