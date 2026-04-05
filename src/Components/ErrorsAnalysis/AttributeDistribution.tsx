import React, { useCallback, useEffect, useReducer, useState } from 'react';

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

export interface AttributeDistributionProps {
  context: DatasetContext;
  // Adapter function -- provided by the consumer. Returns detected fields for
  // the given context. The consumer is responsible for filtering, label mapping,
  // and any dataset-specific field discovery logic.
  fetchAttributes: (context: DatasetContext) => Promise<AttributeConfig[]>;
  // Adapter function -- provided by the consumer. Returns value counts for a
  // single field within the dataset described by context.
  fetchDistribution: (context: DatasetContext, field: string) => Promise<LabelValueCount[]>;
  onFilterApply?: (label: string, value: string) => void;
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
  // Use this whenever the underlying query caps the number of events so users
  // understand the distributions are based on a sample, not the full dataset.
  queryLimitLabel?: string;
}

export function AttributeDistribution({
  context,
  fetchAttributes,
  fetchDistribution,
  onFilterApply,
  priorityAttributes = [],
  queryLimitLabel,
}: AttributeDistributionProps) {
  const styles = useStyles2(getStyles);
  const [newFieldInput, setNewFieldInput] = useState('');

  const [state, dispatch] = useReducer(reducer, {
    attributes: [],
    data: {},
    detecting: false,
  });

  const loadDistributions = useCallback(
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
            const values = await fetchDistribution(context, attr.field);
            dispatch({ type: 'LOADED', field: attr.field, values });
          } catch {
            dispatch({ type: 'ERROR', field: attr.field });
          }
        })
      );
    },
    // fetchDistribution is stable (module-level function); context fields are the
    // true dependencies. Listing context object directly would re-run on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.query, context.datasourceUid, context.timeRange.from, context.timeRange.to]
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
      loadDistributions(ordered);
    }

    run();

    return () => {
      cancelled = true;
    };
    // fetchAttributes is stable (module-level function); context fields and
    // priorityAttributes are the true dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.query, context.datasourceUid, context.timeRange.from, context.timeRange.to, priorityAttributes]);

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
    loadDistributions([config]);
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
