import React from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { of } from 'rxjs';

import {
  ActiveFilter,
  AttributeDistribution,
  AttributeExplorerAnalyticsEvent,
  DatasetContext,
} from './AttributeDistribution';

jest.mock('services/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

// Simplified @grafana/ui stubs. WithContextMenu renders its children plus the menu
// inline so filter menu items are immediately accessible in tests.
jest.mock('@grafana/ui', () => ({
  Combobox: ({
    options,
    onChange,
  }: {
    onChange: (option: unknown) => void;
    options: Array<{ label: string; value: string }>;
  }) => (
    <button data-testid="pin-attribute" onClick={() => onChange(options[0])}>
      Pin attribute
    </button>
  ),
  Icon: () => null,
  MenuItem: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button data-testid={`menu-item-${label}`} onClick={onClick}>
      {label}
    </button>
  ),
  Spinner: () => null,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  WithContextMenu: ({
    children,
    renderMenuItems,
  }: {
    children: (props: { openMenu: () => void }) => React.ReactNode;
    renderMenuItems: () => React.ReactNode;
  }) => (
    <>
      {children({ openMenu: () => {} })}
      {renderMenuItems()}
    </>
  ),
  useStyles2: () => ({
    bar: '',
    barWrapper: '',
    container: '',
    count: '',
    detectingRow: '',
    emptyRow: '',
    emptyState: '',
    expandToggle: '',
    fieldLinkIcon: '',
    header: '',
    loadingRow: '',
    percentage: '',
    queryLimit: '',
    section: '',
    sectionHeader: '',
    sectionHeaderActive: '',
    sectionHeaderRow: '',
    sectionLabel: '',
    sections: '',
    showAllLink: '',
    showMoreButton: '',
    showMoreButtonDisabled: '',
    showMoreFields: '',
    stats: '',
    title: '',
    valueLabel: '',
    valueRow: '',
    valueRowExcluded: '',
    valueRowHeader: '',
    valueRowIncluded: '',
    valueRowRetained: '',
  }),
  useTheme2: () => ({
    visualization: {
      palette: ['#5794F2', '#FF9830', '#73BF69', '#F2495C', '#B877D9', '#6ED0E0'],
      getColorByName: (name: string) => {
        const colorMap: Record<string, string> = {};
        return colorMap[name] || '#000000';
      },
    },
    colors: {
      primary: { main: '#5794F2' },
    },
  }),
}));

const context: DatasetContext = {
  datasourceUid: 'ds-1',
  query: '{app="test"}',
  timeRange: { from: 1_000_000, to: 2_000_000 },
};

// ---------------------------------------------------------------------------
// snapshot stability
// ---------------------------------------------------------------------------

describe('AttributeDistribution snapshot stability', () => {
  it('retains pre-filter values after a filter is applied and display props get new references', async () => {
    // The underlying jest.fn() tracks actual detection calls.
    const fetchAttributesMock = jest.fn().mockResolvedValue([{ attribute: 'browser', attribute_name: 'Browser' }]);

    const fetchDistribution = jest
      .fn()
      .mockImplementation((_ctx: DatasetContext, _field: string, filters: ActiveFilter[]) =>
        of(
          filters.length === 0
            ? [
                { count: 80, percentage: 80, value: 'Chrome' },
                { count: 20, percentage: 20, value: 'Firefox' },
              ]
            : [{ count: 100, percentage: 100, value: 'Chrome' }]
        )
      );

    // Wrapper creates new object/function references on every render, reproducing the
    // unstable-prop pattern that caused spurious re-detection before the fix.
    function Wrapper({ _trigger }: { _trigger: number }) {
      return (
        <AttributeDistribution
          attributeLabels={{ browser: 'Browser' }}
          context={context}
          fetchAttributes={() => fetchAttributesMock(context)}
          fetchDistribution={fetchDistribution}
          priorityAttributes={[]}
        />
      );
    }

    const { rerender } = render(<Wrapper _trigger={0} />);

    // Wait for initial detection and distribution load.
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchAttributesMock).toHaveBeenCalledTimes(1);

    // Expand the section so all values are visible (MAX_VALUES_COLLAPSED = 1 hides extras).
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

    // Both values must be visible after the unfiltered load.
    expect(screen.getByText('Chrome')).toBeInTheDocument();
    expect(screen.getByText('Firefox')).toBeInTheDocument();

    // Apply a filter for Chrome. Because WithContextMenu is stubbed to render menu
    // items inline, the "Filter for value" button is directly accessible.
    // getAllByTestId returns one button per value row; the first is Chrome's.
    const filterForValueButtons = screen.getAllByTestId('menu-item-Filter for value');
    fireEvent.click(filterForValueButtons[0]);

    // Re-render with fresh references for the three formerly-unstable props.
    // Before the fix this triggered DETECTING, which cleared valueSnapshot.
    await act(async () => {
      rerender(<Wrapper _trigger={1} />);
      await Promise.resolve();
    });

    // Re-detection must not have occurred.
    expect(fetchAttributesMock).toHaveBeenCalledTimes(1);

    // Firefox must still be present in the sidebar as a retained (0%) value.
    // If the snapshot was cleared by a spurious DETECTING, Firefox would disappear.
    expect(screen.getByText('Firefox')).toBeInTheDocument();
  });
});

describe('AttributeDistribution analytics', () => {
  it('reports filter, expand, pin, and field visibility interactions', async () => {
    const analyticsEvents: AttributeExplorerAnalyticsEvent[] = [];
    const attributes = Array.from({ length: 11 }, (_, index) => ({
      attribute: `field-${index}`,
      attribute_name: `Field ${index}`,
    }));
    const fetchAttributes = jest.fn().mockResolvedValue(attributes);
    const fetchDistribution = jest.fn().mockReturnValue(
      of([
        { count: 80, percentage: 80, value: 'Chrome' },
        { count: 20, percentage: 20, value: 'Firefox' },
      ])
    );

    render(
      <AttributeDistribution
        context={context}
        fetchAttributes={fetchAttributes}
        fetchDistribution={fetchDistribution}
        onAnalyticsEvent={(event) => analyticsEvents.push(event)}
        priorityAttributes={[]}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Expand' })[0]);
    fireEvent.click(screen.getAllByTestId('menu-item-Filter for value')[0]);
    fireEvent.click(screen.getByTitle('Show 1 more fields'));
    fireEvent.click(screen.getByTitle('Collapse extra fields'));
    fireEvent.click(screen.getByTestId('pin-attribute'));

    expect(analyticsEvents).toEqual([
      { type: 'attribute_expanded', attribute: 'field-0' },
      { type: 'filter_applied', attribute: 'field-0', operator: '=' },
      { type: 'fields_toggled', action: 'show_more', fields: 1 },
      { type: 'fields_toggled', action: 'collapse', fields: 1 },
      { type: 'attribute_pinned', attribute: 'field-0' },
    ]);
  });
});
