import React from 'react';

import { render, screen } from '@testing-library/react';

import { createTheme, DataFrame, dateTime } from '@grafana/data';
import { sceneGraph } from '@grafana/scenes';

import { PatternFrame } from './PatternsBreakdownScene';
import { PatternsTableCellData, PatternsViewTableScene } from './PatternsViewTableScene';
import { testIds } from 'services/testIds';

jest.mock('./PatternNameLabel', () => ({
  PatternNameLabel: ({ pattern }: { pattern: string }) => <span>{pattern}</span>,
}));

jest.mock('services/scenes', () => ({
  getExplorationFor: jest.fn(),
}));

const theme = createTheme();

function buildScene() {
  jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
    state: { value: { from: dateTime(), raw: { from: 'now-15m', to: 'now' }, to: dateTime() } },
  } as never);
  return new PatternsViewTableScene({ patternFrames: [] });
}

function buildPatternFrame(pattern: string, sum: number, levels: string[]): PatternFrame {
  return { dataFrame: {} as DataFrame, levels, pattern, sum };
}

function buildRow(overrides: Partial<PatternsTableCellData> = {}): PatternsTableCellData {
  return {
    dataFrame: {} as DataFrame,
    excludeLink: jest.fn(),
    includeLink: jest.fn(),
    levels: ['warn', 'info'],
    pattern: 'level=info msg=<_>',
    sum: 2500,
    togglePatternLevel: jest.fn(),
    undoLink: jest.fn(),
    ...overrides,
  };
}

describe('PatternsViewTableScene.buildColumns', () => {
  const patternFrames = [buildPatternFrame('a', 100, ['info']), buildPatternFrame('b', 300, [])];

  it('keeps the multi-column layout by default', () => {
    const columns = buildScene().buildColumns(400, [], theme, 100, patternFrames, [], []);

    expect(columns.map((column) => column.id)).toEqual([
      'volume-samples',
      'levels',
      'count',
      'percent',
      'pattern',
      'include',
    ]);
  });

  it('collapses to a single pattern column when small', () => {
    const columns = buildScene().buildColumns(400, [], theme, 100, patternFrames, [], [], true);

    expect(columns.map((column) => column.id)).toEqual(['pattern']);
  });

  describe('small cell', () => {
    function renderSmallCell(row: PatternsTableCellData, options?: { notMatching?: string[] }) {
      const [column] = buildScene().buildColumns(10000, [], theme, 100, patternFrames, options?.notMatching, [], true);
      const cell = column.cell as (props: unknown) => React.ReactElement;
      return render(cell({ cell: { row: { original: row } } }));
    }

    it('shows the pattern, count, percentage and levels together', () => {
      renderSmallCell(buildRow());

      expect(screen.getByTestId(testIds.patterns.smallCell)).toBeInTheDocument();
      expect(screen.getByText('level=info msg=<_>')).toBeInTheDocument();
      expect(screen.getByText('2.50 K')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'info' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'warn' })).toBeInTheDocument();
    });

    it('captions each stat since the table headers are not shown', () => {
      renderSmallCell(buildRow());

      expect(screen.getByText('Count')).toBeInTheDocument();
      expect(screen.getByText('Percent')).toBeInTheDocument();
      expect(screen.getByText('Levels')).toBeInTheDocument();
    });

    it('omits the levels stat when the pattern has no levels', () => {
      renderSmallCell(buildRow({ levels: [] }));

      expect(screen.getByText('Count')).toBeInTheDocument();
      expect(screen.queryByText('Levels')).not.toBeInTheDocument();
    });

    it('wires the level and filter buttons to the row callbacks', () => {
      const row = buildRow();
      renderSmallCell(row);

      screen.getByRole('button', { name: 'warn' }).click();
      screen.getByRole('button', { name: 'Include' }).click();
      screen.getByRole('button', { name: 'Exclude' }).click();

      expect(row.togglePatternLevel).toHaveBeenCalledWith('warn');
      expect(row.includeLink).toHaveBeenCalledTimes(1);
      expect(row.excludeLink).toHaveBeenCalledTimes(1);
    });

    it('hides the filter buttons for patterns that do not match the current filters', () => {
      renderSmallCell(buildRow(), { notMatching: ['level=info msg=<_>'] });

      expect(screen.queryByRole('button', { name: 'Include' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Exclude' })).not.toBeInTheDocument();
    });
  });
});
