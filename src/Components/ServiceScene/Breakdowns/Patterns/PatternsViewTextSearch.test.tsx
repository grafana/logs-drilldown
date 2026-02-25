import React, { useMemo, useState } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sceneGraph } from '@grafana/scenes';

import { PatternTextSearchComponent, PatternsViewTextSearch } from './PatternsViewTextSearch';

const NON_INDEXED_FILTERS_ALERT_TEXT =
  /Parsed fields, structured metadata, and string filters are not supported for the pattern list/;

const mockGetAncestor = jest.spyOn(sceneGraph, 'getAncestor');
const mockGetFieldsVariable = jest.fn();
const mockGetMetadataVariable = jest.fn();
const mockGetLineFiltersVariable = jest.fn();

jest.mock('../../../../services/variableGetters', () => ({
  getFieldsVariable: (...args: unknown[]) => mockGetFieldsVariable(...args),
  getMetadataVariable: (...args: unknown[]) => mockGetMetadataVariable(...args),
  getLineFiltersVariable: (...args: unknown[]) => mockGetLineFiltersVariable(...args),
}));

function createVariableMock(filters: Array<{ key: string; operator: string; value: string }>) {
  return {
    useState: () => ({ filters }),
  };
}

function TestWrapper({ model, onSetState }: { model: PatternsViewTextSearch; onSetState: jest.Mock }) {
  const [patternFilter, setPatternFilter] = useState('');
  const breakdownScene = useMemo(
    () => ({
      setState: (update: { patternFilter?: string }) => {
        if (update.patternFilter !== undefined) {
          setPatternFilter(update.patternFilter);
          onSetState(update);
        }
      },
      useState: () => ({ patternFilter }),
    }),
    [patternFilter, onSetState]
  );
  mockGetAncestor.mockReturnValue(breakdownScene);
  return <PatternTextSearchComponent model={model} />;
}

describe('PatternsViewTextSearch', () => {
  let setStateSpy: jest.Mock;
  let model: PatternsViewTextSearch;

  beforeEach(() => {
    jest.clearAllMocks();
    setStateSpy = jest.fn();
    mockGetFieldsVariable.mockReturnValue(createVariableMock([]));
    mockGetMetadataVariable.mockReturnValue(createVariableMock([]));
    mockGetLineFiltersVariable.mockReturnValue(createVariableMock([]));
    model = new PatternsViewTextSearch();
  });

  describe('PatternTextSearchComponent', () => {
    it('renders search input with placeholder', () => {
      mockGetAncestor.mockReturnValue({
        setState: jest.fn(),
        useState: () => ({ patternFilter: '' }),
      });
      render(<PatternTextSearchComponent model={model} />);

      expect(screen.getByPlaceholderText('Search patterns')).toBeInTheDocument();
    });

    it('does not show alert when no non-indexed filters are present', () => {
      mockGetAncestor.mockReturnValue({
        setState: jest.fn(),
        useState: () => ({ patternFilter: '' }),
      });
      render(<PatternTextSearchComponent model={model} />);

      expect(screen.queryByText(NON_INDEXED_FILTERS_ALERT_TEXT)).not.toBeInTheDocument();
    });

    it('shows alert when field filters are present', () => {
      mockGetAncestor.mockReturnValue({
        setState: jest.fn(),
        useState: () => ({ patternFilter: '' }),
      });
      mockGetFieldsVariable.mockReturnValue(createVariableMock([{ key: 'caller', operator: '=', value: 'main' }]));

      render(<PatternTextSearchComponent model={model} />);

      expect(screen.getByText(NON_INDEXED_FILTERS_ALERT_TEXT)).toBeInTheDocument();
    });

    it('shows alert when metadata filters are present', () => {
      mockGetAncestor.mockReturnValue({
        setState: jest.fn(),
        useState: () => ({ patternFilter: '' }),
      });
      mockGetMetadataVariable.mockReturnValue(createVariableMock([{ key: 'level', operator: '=', value: 'info' }]));

      render(<PatternTextSearchComponent model={model} />);

      expect(screen.getByText(NON_INDEXED_FILTERS_ALERT_TEXT)).toBeInTheDocument();
    });

    it('shows alert when line filters are present', () => {
      mockGetAncestor.mockReturnValue({
        setState: jest.fn(),
        useState: () => ({ patternFilter: '' }),
      });
      mockGetLineFiltersVariable.mockReturnValue(createVariableMock([{ key: 'match', operator: '=', value: 'error' }]));

      render(<PatternTextSearchComponent model={model} />);

      expect(screen.getByText(NON_INDEXED_FILTERS_ALERT_TEXT)).toBeInTheDocument();
    });

    it('shows alert when multiple filter types are present', () => {
      mockGetAncestor.mockReturnValue({
        setState: jest.fn(),
        useState: () => ({ patternFilter: '' }),
      });
      mockGetFieldsVariable.mockReturnValue(createVariableMock([{ key: 'caller', operator: '=', value: 'main' }]));
      mockGetLineFiltersVariable.mockReturnValue(createVariableMock([{ key: 'match', operator: '=', value: 'error' }]));

      render(<PatternTextSearchComponent model={model} />);

      expect(screen.getByText(NON_INDEXED_FILTERS_ALERT_TEXT)).toBeInTheDocument();
    });
  });

  describe('model interactions', () => {
    it('calls parent setState with patternFilter when handleSearchChange is triggered', async () => {
      render(<TestWrapper model={model} onSetState={setStateSpy} />);

      const input = screen.getByPlaceholderText('Search patterns');
      await userEvent.type(input, 'foo');

      expect(setStateSpy).toHaveBeenCalledWith({ patternFilter: 'f' });
      expect(setStateSpy).toHaveBeenCalledWith({ patternFilter: 'fo' });
      expect(setStateSpy).toHaveBeenCalledWith({ patternFilter: 'foo' });
    });

    it('calls parent setState to clear patternFilter when clearSearch is triggered', async () => {
      mockGetAncestor.mockReturnValue({
        setState: setStateSpy,
        useState: () => ({ patternFilter: 'existing' }),
      });
      render(<PatternTextSearchComponent model={model} />);

      const clearButton = screen.getByLabelText('Clear search');
      await userEvent.click(clearButton);

      expect(setStateSpy).toHaveBeenCalledWith({ patternFilter: '' });
    });
  });
});
