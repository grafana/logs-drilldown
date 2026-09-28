import React, { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { css, cx } from '@emotion/css';
import { createPortal } from 'react-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AdHocFiltersVariable } from '@grafana/scenes';
import { Tooltip, useStyles2 } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { FilterConnector, getFilterConnectors, toggleFilterConnector } from 'services/fieldFilterOrGroups';
import { testIds } from 'services/testIds';

// Rendered by the scenes AdHocFiltersComboboxRenderer directly before the filter pills
const PILLS_ANNOUNCER_SELECTOR = '[data-testid="AdHocFilter-label-announcer"]';
const CONNECTOR_SLOT_ATTRIBUTE = 'data-filter-connector-slot';

interface Props {
  children: ReactNode;
  variable: AdHocFiltersVariable;
}

// Scenes doesn't expose a slot between filter pills, so each connector is portaled into an element inserted before a pill
export function FieldFilterConnectors({ children, variable }: Props) {
  const { filters } = variable.useState();
  const connectors = getFilterConnectors(filters);
  const containerRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<HTMLElement[]>([]);
  const [slots, setSlots] = useState<HTMLElement[]>([]);
  const styles = useStyles2(getStyles);

  const syncSlots = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const nextSlots = placeConnectorSlots(container, connectors.length, slotsRef.current);
    slotsRef.current = nextSlots;
    setSlots((prevSlots) =>
      prevSlots.length === nextSlots.length && prevSlots.every((slot, index) => slot === nextSlots[index])
        ? prevSlots
        : nextSlots
    );
  }, [connectors.length]);

  useLayoutEffect(syncSlots);

  // Pills are re-rendered by scenes (e.g. when switching to edit mode) without re-rendering this component
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new MutationObserver(syncSlots);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [syncSlots]);

  const onToggle = (connectorIndex: number) => {
    const nextFilters = toggleFilterConnector(variable.state.filters, connectorIndex);
    const nextConnector = getFilterConnectors(nextFilters)[connectorIndex];
    variable.updateFilters(nextFilters);

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.field_filter_connector_toggled,
      {
        connector: nextConnector ?? '',
        filtersLength: nextFilters.length,
      }
    );
  };

  return (
    <div ref={containerRef} className={styles.container}>
      {children}
      {slots.map((slot, index) => {
        const connector = connectors[index];
        return connector
          ? createPortal(
              <FilterConnectorButton connector={connector} onToggle={() => onToggle(index)} />,
              slot,
              `${index}`
            )
          : null;
      })}
    </div>
  );
}

/** Makes sure a slot element sits directly before every pill but the first one, reusing the existing slots */
function placeConnectorSlots(container: HTMLElement, connectorCount: number, existingSlots: HTMLElement[]) {
  const announcer = container.querySelector(PILLS_ANNOUNCER_SELECTOR);
  const pillsWrapper = announcer?.parentElement;
  const slots: HTMLElement[] = [];

  if (announcer && pillsWrapper) {
    // Pills in view or edit mode are the siblings that follow the announcer, one element per filter
    const pills: Element[] = [];
    for (
      let sibling = announcer.nextElementSibling;
      sibling && pills.length <= connectorCount;
      sibling = sibling.nextElementSibling
    ) {
      if (!sibling.hasAttribute(CONNECTOR_SLOT_ATTRIBUTE)) {
        pills.push(sibling);
      }
    }

    for (let index = 0; index < connectorCount; index++) {
      const pill = pills[index + 1];
      if (pill == null) {
        break;
      }

      const slot = existingSlots[index] ?? createConnectorSlot();
      if (pill.previousElementSibling !== slot) {
        pillsWrapper.insertBefore(slot, pill);
      }
      slots.push(slot);
    }
  }

  existingSlots.slice(slots.length).forEach((slot) => slot.remove());
  return slots;
}

function createConnectorSlot() {
  const slot = document.createElement('span');
  slot.setAttribute(CONNECTOR_SLOT_ATTRIBUTE, '');
  return slot;
}

function FilterConnectorButton({ connector, onToggle }: { connector: FilterConnector; onToggle: () => void }) {
  const styles = useStyles2(getStyles);
  const orLabel = t('components.index-scene.field-filter-connectors.or', 'or');

  if (connector === 'sameFieldOr') {
    return (
      <Tooltip
        content={t(
          'components.index-scene.field-filter-connectors.same-field-tooltip',
          'Filters on the same field are always combined with OR'
        )}
      >
        <span
          className={cx(styles.connector, styles.or, styles.static)}
          data-testid={testIds.variables.fields.filterConnector}
        >
          {orLabel}
        </span>
      </Tooltip>
    );
  }

  const isOr = connector === 'or';
  const tooltip = isOr
    ? t(
        'components.index-scene.field-filter-connectors.or-tooltip',
        'Matches logs that satisfy either filter. Click to require both (AND).'
      )
    : t(
        'components.index-scene.field-filter-connectors.and-tooltip',
        'Matches logs that satisfy both filters. Click to require either (OR).'
      );

  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        className={cx(styles.connector, isOr && styles.or)}
        aria-label={tooltip}
        data-testid={testIds.variables.fields.filterConnector}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        {isOr ? orLabel : t('components.index-scene.field-filter-connectors.and', 'and')}
      </button>
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'contents',
  }),
  connector: css({
    ...theme.typography.bodySmall,
    background: 'none',
    border: `1px dashed ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: 1,
    padding: theme.spacing(0.25, 0.5),
    textTransform: 'uppercase',
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
  }),
  or: css({
    borderColor: theme.colors.primary.border,
    borderStyle: 'solid',
    color: theme.colors.primary.text,
  }),
  static: css({
    borderStyle: 'dotted',
    cursor: 'default',
    '&:hover': {
      background: 'none',
      color: theme.colors.primary.text,
    },
  }),
});
