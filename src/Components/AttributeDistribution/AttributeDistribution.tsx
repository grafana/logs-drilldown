import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { css, cx } from '@emotion/css';
import { Observable, Subscription } from 'rxjs';

import { colorManipulator, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Combobox, Icon, MenuItem, Spinner, Tooltip, WithContextMenu, useStyles2 } from '@grafana/ui';

import { logger } from '../../services/logger';
import {
  ActiveFilter,
  AttributeConfig,
  AttributeState,
  AttributeValueCount,
  State,
  computeNextFilters,
  mergeWithSnapshot,
  orderByPriority,
  reducer,
} from './attributeDistributionState';

export type { ActiveFilter, AttributeConfig, AttributeValueCount } from './attributeDistributionState';

const MAX_VALUES_COLLAPSED = 1;
const MAX_VALUES_EXPANDED = 10;
const EMPTY_PRIORITY_ATTRIBUTES: string[] = [];
const EMPTY_ATTRIBUTE_LABELS: Record<string, string> = {};

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
  fetchDistribution: (context: DatasetContext, field: string, filters: ActiveFilter[]) => Observable<AttributeValueCount[]>;
  // Returns a URL to view full distribution for a field in Logs Drilldown. Return undefined to hide the link.
  getFieldLink?: (attribute: string) => string | undefined;
  // Replaces the default header. Pass null to hide the header entirely.
  header?: React.ReactNode;
  // Display name overrides for raw attribute names. Applied to detected and undetected priority attributes alike.
  attributeLabels?: Record<string, string>;
  // Called whenever the active filter set changes.
  onFiltersChange?: (filters: ActiveFilter[]) => void;
  // Attributes pinned to the top of the list. Absent priority attributes are still shown.
  priorityAttributes?: string[];
  // Label shown at the top of the sidebar communicating the dataset scope. Example: "Last 1000 logs".
  queryLimitLabel?: string;
  // Active filter set. Updated by the consumer when external filters change.
  selectedFilters?: ActiveFilter[];
  showAllLink?: { href: string; title: string };
}

export function AttributeDistribution({
  attributeLabels = EMPTY_ATTRIBUTE_LABELS,
  context,
  fetchAttributes,
  fetchDistribution,
  getFieldLink,
  header,
  selectedFilters: selectedFiltersProp,
  onFiltersChange,
  priorityAttributes = EMPTY_PRIORITY_ATTRIBUTES,
  queryLimitLabel,
  showAllLink,
}: AttributeDistributionProps) {
  const styles = useStyles2(getStyles);
  const [extraFieldsShown, setExtraFieldsShown] = useState(0);

  const [state, dispatch] = useReducer(
    reducer,
    selectedFiltersProp ?? [],
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
  const userPinnedRef = useRef(state.userPinnedAttributes);
  userPinnedRef.current = state.userPinnedAttributes;

  // Incremented on every loadDistributions call. Each async fetch captures the
  // generation at the time it starts and drops its result if the counter has
  // advanced, preventing stale results from a previous context from dispatching
  // LOADED into the current view.
  const generationRef = useRef(0);
  const subscriptionsRef = useRef<Subscription[]>([]);
  // Tracks which fields have had a fetch started. Cleared on full reload so the
  // lazy-load effect can detect newly visible fields that still need fetching.
  const fetchedFieldsRef = useRef<Set<string>>(new Set());
  // Always-current ref to visibleAttributes. Declared early so effects above the
  // useMemo can read it; assigned after the useMemo below.
  const visibleAttributesRef = useRef<AttributeConfig[]>([]);

  const loadDistributions = useCallback(
    (attributes: AttributeConfig[], ctx: DatasetContext, filters: ActiveFilter[]) => {
      if (!attributes.length) {
        return;
      }
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];
      fetchedFieldsRef.current.clear();

      const generation = ++generationRef.current;
      attributes.forEach((attr) => {
        fetchedFieldsRef.current.add(attr.attribute);
        dispatch({ type: 'LOADING', field: attr.attribute });
      });

      attributes.forEach((attr) => {
        const sub = fetchDistribution(ctx, attr.attribute, filters).subscribe({
          next: (values) => {
            if (generationRef.current === generation) {
              dispatch({ type: 'LOADED', field: attr.attribute, values });
            }
          },
          error: (e) => {
            logger.error(e);
            if (generationRef.current === generation) {
              dispatch({
                type: 'ERROR',
                field: attr.attribute,
                message: e instanceof Error && e.message ? e.message : t('errors-analysis.error', 'Failed to load'),
              });
            }
          },
        });
        subscriptionsRef.current.push(sub);
      });
    },
    [fetchDistribution]
  );

  const loadDistributionsRef = useRef(loadDistributions);
  loadDistributionsRef.current = loadDistributions;

  // Fetches distributions for additional fields without cancelling existing in-flight requests.
  // Used when new fields become visible (show more, pin attribute) so already-loading fields
  // are not disrupted. Uses the current generation so stale results are still dropped on reload.
  const loadAdditional = useCallback(
    (attributes: AttributeConfig[], ctx: DatasetContext, filters: ActiveFilter[]) => {
      if (!attributes.length) {
        return;
      }
      const generation = generationRef.current;
      attributes.forEach((attr) => {
        fetchedFieldsRef.current.add(attr.attribute);
        dispatch({ type: 'LOADING', field: attr.attribute });
      });
      attributes.forEach((attr) => {
        const sub = fetchDistribution(ctx, attr.attribute, filters).subscribe({
          next: (values) => {
            if (generationRef.current === generation) {
              dispatch({ type: 'LOADED', field: attr.attribute, values });
            }
          },
          error: (e) => {
            logger.error(e);
            if (generationRef.current === generation) {
              dispatch({
                type: 'ERROR',
                field: attr.attribute,
                message: e instanceof Error && e.message ? e.message : t('errors-analysis.error', 'Failed to load'),
              });
            }
          },
        });
        subscriptionsRef.current.push(sub);
      });
    },
    [fetchDistribution]
  );

  const loadAdditionalRef = useRef(loadAdditional);
  loadAdditionalRef.current = loadAdditional;

  // Sync internal filter state when selectedFilters prop changes externally (e.g. user
  // removes a filter from the page-level filter bar). Skips the initial mount since the
  // reducer lazy initializer already seeds from selectedFiltersProp on first render.
  // context, state.attributes, and loadDistributions are read via always-current refs so
  // they do not need to be deps (re-running on those changes is handled by the main effect).
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    const filters = selectedFiltersProp ?? [];
    dispatch({ type: 'SET_FILTERS', filters });
    if (attributesRef.current.length > 0) {
      loadDistributionsRef.current(visibleAttributesRef.current, contextRef.current, filters);
    }
  }, [selectedFiltersProp]);

  useEffect(() => {
    if (!context.datasourceUid || !context.query) {
      return;
    }

    let cancelled = false;

    async function run() {
      setExtraFieldsShown(0);
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
      const ordered = orderByPriority(detected, priorityAttributes, attributeLabels);
      dispatch({ type: 'SET_ATTRIBUTES', configs: ordered });
      const activeFilters = selectedFiltersRef.current;

      // Only fetch distributions for initially visible fields. Fields that become
      // visible later (show more, pin) are fetched by the visibleAttributes effect.
      const priorityFieldSet = new Set(priorityAttributes);
      const userPinned = new Set(userPinnedRef.current);
      const pAndP = ordered.filter((a) => priorityFieldSet.has(a.attribute) || userPinned.has(a.attribute));
      const nonP = ordered.filter((a) => !priorityFieldSet.has(a.attribute) && !userPinned.has(a.attribute));
      const initialBatch = priorityAttributes.length === 0 ? 10 : 0;
      const initialVisible = [...pAndP, ...nonP.slice(0, initialBatch)];
      loadDistributions(initialVisible, contextRef.current, activeFilters);
    }

    run();

    return () => {
      cancelled = true;
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [context.query, context.datasourceUid, context.timeRange.from, context.timeRange.to, priorityAttributes, fetchAttributes, loadDistributions]);

  function handleToggleFilter(field: string, value: string, operator: '!=' | '=') {
    const newFilters = computeNextFilters(state.selectedFilters, field, value, operator);
    dispatch({ type: 'TOGGLE_FILTER', field, value, operator });
    loadDistributions(visibleAttributes, context, newFilters);
    onFiltersChange?.(newFilters);
  }

  function handlePinAttribute(attribute: string) {
    dispatch({ type: 'PIN_ATTRIBUTE', attribute });
  }

  const { nonPriorityAttributes, priorityAndPinned, comboboxOptions } = useMemo(() => {
    const priorityFieldSet = new Set(priorityAttributes);
    const pinnedSet = new Set(state.userPinnedAttributes);
    const nonPriority = state.attributes.filter(
      (a) => !priorityFieldSet.has(a.attribute) && !pinnedSet.has(a.attribute)
    );
    const pinned = state.attributes.filter(
      (a) => priorityFieldSet.has(a.attribute) || pinnedSet.has(a.attribute)
    );
    return {
      comboboxOptions: nonPriority.map((a) => ({ label: a.attribute_name, value: a.attribute })),
      nonPriorityAttributes: nonPriority,
      priorityAndPinned: pinned,
    };
  }, [priorityAttributes, state.attributes, state.userPinnedAttributes]);

  const { visibleAttributes, remainingCount, nextBatch } = useMemo(() => {
    // When no priority attributes were provided, auto-show the first 10 so users see
    // something immediately without having to click "show more".
    // Use priorityAttributes.length (the prop) not priorityAndPinned.length so that
    // user-pinning a field does not collapse the initial batch.
    const initialVisible = priorityAttributes.length === 0 ? 10 : 0;
    const totalShown = initialVisible + extraFieldsShown;
    const activeFilterFields = new Set(state.selectedFilters.map((f) => f.field));
    // Always include non-priority fields with active filters so a selected value is never hidden.
    const visibleNonPriority = nonPriorityAttributes.filter(
      (a, i) => i < totalShown || activeFilterFields.has(a.attribute)
    );
    // Clamp to 0: extraFieldsShown can exceed length after a context change reduces detected fields.
    const remaining = Math.max(0, nonPriorityAttributes.length - visibleNonPriority.length);
    return {
      nextBatch: Math.min(10, remaining),
      remainingCount: remaining,
      visibleAttributes: [...priorityAndPinned, ...visibleNonPriority],
    };
  }, [nonPriorityAttributes, extraFieldsShown, priorityAndPinned, priorityAttributes, state.selectedFilters]);

  visibleAttributesRef.current = visibleAttributes;

  // Fetch distributions for any visible field that hasn't been fetched yet.
  // Fires when visibleAttributes grows (show more, pin attribute) without
  // disrupting in-flight requests for already-visible fields.
  useEffect(() => {
    const notYetFetched = visibleAttributes.filter((a) => !fetchedFieldsRef.current.has(a.attribute));
    if (notYetFetched.length > 0) {
      loadAdditionalRef.current(notYetFetched, contextRef.current, selectedFiltersRef.current);
    }
  }, [visibleAttributes]);

  return (
    <div className={styles.container}>
      {header !== undefined ? header : (
        <div className={styles.header}>
          <div className={styles.title}>
            {t('errors-analysis.title', 'Attribute Explorer')}
            <Tooltip content={t('errors-analysis.description', 'Spot patterns and narrow down root causes by exploring how your data breaks down across key attributes. Click any value to filter your results.')}>
              <Icon name="info-circle" size="sm" />
            </Tooltip>
          </div>
          {queryLimitLabel && <div className={styles.queryLimit}>{queryLimitLabel}</div>}
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
              fieldLink={getFieldLink?.(attr.attribute)}
              hasActiveFilter={fieldFilters.length > 0}
              includedValues={includedValues}
              excludedValues={excludedValues}
              snapshotValues={snapshotValues}
              onToggleFilter={(value, operator) => handleToggleFilter(attr.attribute, value, operator)}
              onToggle={() => dispatch({ type: 'TOGGLE_EXPANDED', field: attr.attribute })}
            />
          );
        })}
        {(nonPriorityAttributes.length > 0 && (extraFieldsShown > 0 || remainingCount > 0)) || showAllLink ? (
          <div className={styles.showMoreFields}>
            {nonPriorityAttributes.length > 0 && (extraFieldsShown > 0 || remainingCount > 0) && (
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
  fieldLink?: string;
  hasActiveFilter: boolean;
  includedValues: Set<string>;
  onToggle: () => void;
  onToggleFilter: (value: string, operator: '!=' | '=') => void;
  snapshotValues: AttributeValueCount[] | null;
}

function AttributeSection({
  attrState,
  config,
  fieldLink,
  hasActiveFilter,
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
      <div className={styles.sectionHeaderRow}>
        <button
          className={cx(styles.sectionHeader, hasActiveFilter && styles.sectionHeaderActive)}
          type="button"
          onClick={isExpandable ? onToggle : undefined}
        >
          <span className={styles.sectionLabel}>{config.attribute_name}</span>
        </button>
        {fieldLink && (
          <a
            aria-label={t('errors-analysis.field-link-label', 'View {{name}} in Logs Drilldown field tab', { name: config.attribute_name })}
            className={styles.fieldLinkIcon}
            data-field-link-icon
            href={fieldLink}
            rel="noreferrer"
            target="_blank"
          >
            <Icon name="external-link-alt" size="sm" />
          </a>
        )}
        {isExpandable && (
          <button
            aria-label={expanded ? t('errors-analysis.collapse', 'Collapse') : t('errors-analysis.expand', 'Expand')}
            className={styles.expandToggle}
            type="button"
            onClick={onToggle}
          >
            <Icon name={expanded ? 'angle-up' : 'angle-down'} size="sm" />
          </button>
        )}
      </div>

      {loading && values.length === 0 && (
        <div className={styles.loadingRow}>
          <Spinner size="sm" />
        </div>
      )}

      {!loading && error && (
        <div className={styles.emptyRow} title={error}>
          {error.length > 100 ? `${error.slice(0, 40)}\u2026` : error}
        </div>
      )}

      {!error && visibleValues.length > 0 && (
        <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s ease' }}>
          {visibleValues.map((item) => {
            const isIncluded = includedValues.has(item.value);
            const isExcluded = excludedValues.has(item.value);
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
                      isIncluded && styles.valueRowIncluded,
                      isExcluded && styles.valueRowExcluded,
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
    padding: theme.spacing(0.5, 2),
  }),
  emptyState: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontStyle: 'italic',
    padding: theme.spacing(1, 0),
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
    paddingBottom: theme.spacing(1),
  }),
  sectionHeaderRow: css({
    alignItems: 'center',
    borderTop: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    '&:hover [data-field-link-icon]': {
      opacity: 1,
    },
  }),
  fieldLinkIcon: css({
    alignItems: 'center',
    color: theme.colors.text.link,
    display: 'flex',
    flexShrink: 0,
    opacity: 0,
    padding: theme.spacing(0, 0.5),
    transition: 'opacity 0.1s',
    '&:hover': {
      color: theme.colors.text.link,
      opacity: 1,
    },
  }),
  sectionHeader: css({
    alignItems: 'center',
    background: 'none',
    border: 'none',
    color: theme.colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    flex: 1,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    minWidth: 0,
    padding: theme.spacing(0.75, 0),
    textAlign: 'left',
    '&:hover': {
      color: theme.colors.text.maxContrast,
    },
  }),
  expandToggle: css({
    alignItems: 'center',
    background: 'none',
    border: 'none',
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    display: 'flex',
    flexShrink: 0,
    marginLeft: 'auto',
    padding: theme.spacing(0, 0.5),
    '&:hover': {
      color: theme.colors.text.primary,
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
    alignItems: 'center',
    color: theme.colors.text.primary,
    display: 'flex',
    fontSize: theme.typography.h6.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    gap: theme.spacing(0.5),
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
    padding: theme.spacing(0.5, 2),
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
  valueRowIncluded: css({
    background: colorManipulator.alpha(theme.colors.success.main, 0.15),
    '&:hover': {
      background: colorManipulator.alpha(theme.colors.success.main, 0.25),
    },
  }),
  valueRowExcluded: css({
    background: colorManipulator.alpha(theme.colors.error.main, 0.15),
    '&:hover': {
      background: colorManipulator.alpha(theme.colors.error.main, 0.25),
    },
  }),
  sectionHeaderActive: css({
    color: theme.colors.text.maxContrast,
  }),
});
