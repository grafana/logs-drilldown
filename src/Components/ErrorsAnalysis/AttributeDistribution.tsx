import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Combobox, Icon, MenuItem, Spinner, WithContextMenu, useStyles2 } from '@grafana/ui';

import { logger } from '../../services/logger';
import {
  ActiveFilter,
  AttributeConfig,
  AttributeState,
  AttributeValueCount,
  State,
  mergeWithSnapshot,
  orderByPriority,
  reducer,
} from './attributeDistributionState';

export type { ActiveFilter, AttributeConfig, AttributeValueCount } from './attributeDistributionState';

const MAX_VALUES_COLLAPSED = 1;
const MAX_VALUES_EXPANDED = 10;

// The slice of state the component needs to fetch data.
// The consumer builds this from its own datasource + query knowledge.
export interface DatasetContext {
  datasourceUid: string;
  query: string;
  timeRange: { from: number; to: number };
}

export interface AttributeDistributionProps {
  context: DatasetContext;
  // Returns detected fields for the given context.
  fetchAttributes: (context: DatasetContext) => Promise<AttributeConfig[]>;
  // Returns value counts for a single field within the dataset described by context.
  fetchDistribution: (context: DatasetContext, field: string, filters: ActiveFilter[]) => Promise<AttributeValueCount[]>;
  // Replaces the default header. Pass null to hide the header entirely.
  header?: React.ReactNode;
  // Seed filter state on first mount so chips reappear after remount without user re-applying them.
  initialSelectedFilters?: ActiveFilter[];
  // Called whenever the active filter set changes.
  onFiltersChange?: (filters: ActiveFilter[]) => void;
  // Attributes pinned to the top of the list. Absent priority attributes are still shown.
  priorityAttributes?: AttributeConfig[];
  // Label shown at the top of the sidebar communicating the dataset scope. Example: "Last 1000 logs".
  queryLimitLabel?: string;
  showAllLink?: { href: string; title: string };
}

export function AttributeDistribution({
  context,
  fetchAttributes,
  fetchDistribution,
  header,
  initialSelectedFilters,
  onFiltersChange,
  priorityAttributes = [],
  queryLimitLabel,
  showAllLink,
}: AttributeDistributionProps) {
  const styles = useStyles2(getStyles);
  const [extraFieldsShown, setExtraFieldsShown] = useState(0);

  const [state, dispatch] = useReducer(
    reducer,
    initialSelectedFilters ?? [],
    (initFilters): State => ({
      attributes: [],
      data: {},
      detecting: false,
      selectedFilters: initFilters,
      userPinnedAttributes: [],
      valueSnapshot: null,
    })
  );

  // Always-current ref so that the initial-load effect can build the effective
  // query without adding selectedFilters to its deps (which would cause
  // redistribution fetches on every filter toggle, handled separately).
  const selectedFiltersRef = useRef(state.selectedFilters);
  selectedFiltersRef.current = state.selectedFilters;

  // Always-current refs used inside effects that should not re-run when these
  // values change (either because re-running is handled elsewhere, or because
  // the value changes on every render and would cause infinite loops).
  const contextRef = useRef(context);
  contextRef.current = context;
  const attributesRef = useRef(state.attributes);
  attributesRef.current = state.attributes;

  // Incremented on every loadDistributions call. Each async fetch captures the
  // generation at the time it starts and drops its result if the counter has
  // advanced, preventing stale results from a previous context from dispatching
  // LOADED into the current view.
  const generationRef = useRef(0);

  const loadDistributions = useCallback(
    async (attributes: AttributeConfig[], ctx: DatasetContext, filters: ActiveFilter[]) => {
      if (!attributes.length) {
        return;
      }
      const generation = ++generationRef.current;
      attributes.forEach((attr) => {
        dispatch({ type: 'LOADING', field: attr.attribute });
      });
      await Promise.allSettled(
        attributes.map(async (attr) => {
          try {
            const values = await fetchDistribution(ctx, attr.attribute, filters);
            if (generationRef.current === generation) {
              dispatch({ type: 'LOADED', field: attr.attribute, values });
            }
          } catch (e) {
            logger.error(e);
            if (generationRef.current === generation) {
              dispatch({ type: 'ERROR', field: attr.attribute });
            }
          }
        })
      );
    },
    [fetchDistribution]
  );

  const loadDistributionsRef = useRef(loadDistributions);
  loadDistributionsRef.current = loadDistributions;

  // Sync internal filter state when initialSelectedFilters changes externally (e.g. user
  // removes a filter from the page-level filter bar). Skips the initial mount since the
  // reducer lazy initializer already seeds from initialSelectedFilters on first render.
  // context, state.attributes, and loadDistributions are read via always-current refs so
  // they do not need to be deps (re-running on those changes is handled by the main effect).
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    const filters = initialSelectedFilters ?? [];
    dispatch({ type: 'SET_FILTERS', filters });
    if (attributesRef.current.length > 0) {
      loadDistributionsRef.current(attributesRef.current, contextRef.current, filters);
    }
  }, [initialSelectedFilters]);

  useEffect(() => {
    if (!context.datasourceUid || !context.query) {
      return;
    }

    let cancelled = false;

    async function run() {
      dispatch({ type: 'DETECTING' });
      let detected: AttributeConfig[] = [];
      try {
        detected = await fetchAttributes(contextRef.current);
      } catch (e) {
        logger.error(e);
      }
      if (cancelled) {
        return;
      }
      const ordered = orderByPriority(detected, priorityAttributes);
      dispatch({ type: 'SET_ATTRIBUTES', configs: ordered });
      const activeFilters = selectedFiltersRef.current;
      loadDistributions(ordered, contextRef.current, activeFilters);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [context.query, context.datasourceUid, context.timeRange.from, context.timeRange.to, priorityAttributes, fetchAttributes, loadDistributions]);

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

    loadDistributions(state.attributes, context, newFilters);
    onFiltersChange?.(newFilters);
  }

  function handleClearFilters() {
    dispatch({ type: 'CLEAR_FILTERS' });
    loadDistributions(state.attributes, context, []);
    onFiltersChange?.([]);
  }

  function handlePinAttribute(attribute: string) {
    dispatch({ type: 'PIN_ATTRIBUTE', attribute });
  }

  const { nonPriorityAttributes, hasSplit, priorityAndPinned, comboboxOptions } = useMemo(() => {
    const priorityFieldSet = new Set(priorityAttributes.map((p) => p.attribute));
    const pinnedSet = new Set(state.userPinnedAttributes);
    const nonPriority = state.attributes.filter(
      (a) => !priorityFieldSet.has(a.attribute) && !pinnedSet.has(a.attribute)
    );
    // Only split if there are both priority/pinned and non-priority fields.
    const split = (priorityFieldSet.size > 0 || pinnedSet.size > 0) && nonPriority.length > 0;
    const pinned = split
      ? state.attributes.filter((a) => priorityFieldSet.has(a.attribute) || pinnedSet.has(a.attribute))
      : state.attributes;
    return {
      comboboxOptions: nonPriority.map((a) => ({ label: a.attribute_name, value: a.attribute })),
      hasSplit: split,
      nonPriorityAttributes: nonPriority,
      priorityAndPinned: pinned,
    };
  }, [priorityAttributes, state.attributes, state.userPinnedAttributes]);

  const { visibleAttributes, remainingCount, nextBatch } = useMemo(() => {
    const visibleNonPriority = nonPriorityAttributes.slice(0, extraFieldsShown);
    // Clamp to 0: extraFieldsShown can exceed length after a context change reduces detected fields.
    const remaining = Math.max(0, nonPriorityAttributes.length - extraFieldsShown);
    return {
      nextBatch: Math.min(10, remaining),
      remainingCount: remaining,
      visibleAttributes: hasSplit ? [...priorityAndPinned, ...visibleNonPriority] : state.attributes,
    };
  }, [nonPriorityAttributes, extraFieldsShown, hasSplit, priorityAndPinned, state.attributes]);

  return (
    <div className={styles.container}>
      {header !== undefined ? header : (
        <div className={styles.header}>
          <div className={styles.title}>{t('errors-analysis.title', 'Attribute Explorer')}</div>
          {queryLimitLabel && <div className={styles.queryLimit}>{queryLimitLabel}</div>}
          <div className={styles.description}>
            {t(
              'errors-analysis.description',
              'Spot patterns and narrow down root causes by exploring how your data breaks down across key attributes. Click any value to filter your results.'
            )}
          </div>
        </div>
      )}

      {state.selectedFilters.length > 0 && (
        <div className={styles.filterChips}>
          {state.selectedFilters.map(({ field, value, operator }) => (
            <div key={`${field}${operator}${value}`} className={styles.chip}>
              <span className={styles.chipText}>
                {field} {operator} {value}
              </span>
              <button
                aria-label={t('errors-analysis.remove-filter-aria', 'Remove filter {{field}} {{operator}} {{value}}', { field, operator, value })}
                className={styles.chipRemove}
                type="button"
                onClick={() => handleToggleFilter(field, value, operator)}
              >
                <Icon name="times" size="xs" />
              </button>
            </div>
          ))}
          <button className={styles.clearAll} type="button" onClick={handleClearFilters}>
            {t('errors-analysis.clear-all', 'Clear all')}
          </button>
        </div>
      )}

      {comboboxOptions.length > 0 && (
        <Combobox
          options={comboboxOptions}
          value={null}
          placeholder={t('errors-analysis.field-input-placeholder', 'Search to add more attributes')}
          onChange={(option) => option && handlePinAttribute(option.value)}
        />
      )}

      {state.detecting && (
        <div className={styles.detectingRow}>
          <Spinner size="sm" />
          <span>{t('errors-analysis.discovering-fields', 'Discovering attributes\u2026')}</span>
        </div>
      )}

      {!state.detecting && state.attributes.length === 0 && (
        <div className={styles.emptyState}>{t('errors-analysis.no-fields-detected', 'No fields detected for this error group.')}</div>
      )}

      <div className={styles.sections}>
        {visibleAttributes.map((attr) => {
          const attrState = state.data[attr.attribute];
          if (!attrState) {
            return null;
          }
          const fieldFilters = state.selectedFilters.filter((f) => f.field === attr.attribute);
          const includedValues = new Set(fieldFilters.filter((f) => f.operator === '=').map((f) => f.value));
          const excludedValues = new Set(fieldFilters.filter((f) => f.operator === '!=').map((f) => f.value));
          const snapshotValues = state.valueSnapshot?.[attr.attribute] ?? null;
          return (
            <AttributeSection
              key={attr.attribute}
              attrState={attrState}
              config={attr}
              includedValues={includedValues}
              excludedValues={excludedValues}
              snapshotValues={snapshotValues}
              onToggleFilter={(value, operator) => handleToggleFilter(attr.attribute, value, operator)}
              onToggle={() => dispatch({ type: 'TOGGLE_EXPANDED', field: attr.attribute })}
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
                  type="button"
                  onClick={() => setExtraFieldsShown(extraFieldsShown + nextBatch)}
                >
                  <Icon name="angle-down" size="sm" />
                </button>
                <button
                  aria-label={t('errors-analysis.collapse-extra-fields', 'Collapse extra fields')}
                  className={cx(styles.showMoreButton, extraFieldsShown === 0 && styles.showMoreButtonDisabled)}
                  disabled={extraFieldsShown === 0}
                  title={extraFieldsShown === 0 ? t('errors-analysis.no-extra-fields-shown', 'No extra fields shown') : t('errors-analysis.collapse-extra-fields', 'Collapse extra fields')}
                  type="button"
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
  snapshotValues: AttributeValueCount[] | null;
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
  const isExpandable = allValues.length > MAX_VALUES_COLLAPSED;

  return (
    <div className={styles.section}>
      <button className={styles.sectionHeader} type="button" onClick={isExpandable ? onToggle : undefined}>
        <span className={styles.sectionLabel}>{config.attribute_name}</span>
        {isExpandable && <Icon name={expanded ? 'angle-up' : 'angle-down'} size="sm" />}
      </button>

      {loading && values.length === 0 && (
        <div className={styles.loadingRow}>
          <Spinner size="sm" />
        </div>
      )}

      {!loading && error && <div className={styles.emptyRow}>{t('errors-analysis.error', 'Failed to load')}</div>}

      {!error && visibleValues.length > 0 && (
        <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s ease' }}>
          {visibleValues.map((item) => {
            const isIncluded = includedValues.has(item.value);
            const isExcluded = excludedValues.has(item.value);
            const isSelected = isIncluded || isExcluded;
            return (
              <WithContextMenu
                key={item.value}
                renderMenuItems={() => (
                  <>
                    <MenuItem
                      label={t('errors-analysis.filter-for-value', 'Filter for value')}
                      onClick={() => onToggleFilter(item.value, '=')}
                    />
                    <MenuItem
                      label={t('errors-analysis.filter-out-value', 'Filter out value')}
                      onClick={() => onToggleFilter(item.value, '!=')}
                    />
                  </>
                )}
              >
                {({ openMenu }) => (
                  <div
                    className={cx(
                      styles.valueRow,
                      isSelected && styles.valueRowSelected,
                      item.retained && styles.valueRowRetained
                    )}
                    onClick={openMenu}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.currentTarget.click();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.valueRowHeader}>
                      <span className={styles.valueLabel} title={item.value}>
                        {item.value}
                      </span>
                      <span className={styles.stats}>
                        <span className={styles.count}>{item.count}</span>
                        <span className={styles.percentage}>{`${item.percentage}%`}</span>
                      </span>
                    </div>
                    <div className={styles.barWrapper}>
                      <div className={styles.bar} style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                )}
              </WithContextMenu>
            );
          })}
        </div>
      )}

      {!loading && !error && allValues.length === 0 && <div className={styles.emptyRow}>{t('errors-analysis.no-values-found', 'No values found')}</div>}

    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
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
    height: '3px',
    overflow: 'hidden',
    width: '100%',
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
  count: css({
    color: theme.colors.text.secondary,
    minWidth: '32px',
    textAlign: 'right',
  }),
  percentage: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    minWidth: '36px',
    textAlign: 'right',
  }),
  stats: css({
    display: 'flex',
    flexShrink: 0,
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
    background: 'none',
    border: 'none',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    fontSize: theme.typography.bodySmall.fontSize,
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 0.5),
    textAlign: 'left',
    width: '100%',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  valueRowHeader: css({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'space-between',
    width: '100%',
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
