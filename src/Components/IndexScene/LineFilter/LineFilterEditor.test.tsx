import React from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import { LineFilterEditor, LineFilterEditorProps } from './LineFilterEditor';
import { LineFilterVariable } from './LineFilterVariable';
import { testIds } from 'services/testIds';

const ids = testIds.variables.lineFilters;

function props(): LineFilterEditorProps {
  return {
    caseSensitive: false,
    exclusive: false,
    focus: false,
    handleEnter: jest.fn(),
    lineFilter: 'error',
    onCaseSensitiveToggle: jest.fn(),
    onClearLineFilter: jest.fn(),
    onInputChange: jest.fn(),
    onRegexToggle: jest.fn(),
    regex: false,
    setExclusive: jest.fn(),
    setFocus: jest.fn(),
    type: 'variable',
    updateFilter: jest.fn(),
  };
}

describe('Line filter selectors', () => {
  it('forwards selectors to the actual input, combobox, and toggle controls', () => {
    const handlers = props();
    render(<LineFilterEditor {...handlers} />);

    expect(screen.getByTestId(testIds.exploreServiceDetails.searchLogs)).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByTestId(ids.operator)).toHaveAttribute('role', 'combobox');
    for (const id of [ids.regexToggle, ids.caseSensitivityToggle, ids.clearButton]) {
      expect(screen.getByTestId(id)).toBeInstanceOf(HTMLButtonElement);
      fireEvent.click(screen.getByTestId(id));
    }
    expect(handlers.onRegexToggle).toHaveBeenCalledWith('regex');
    expect(handlers.onCaseSensitiveToggle).toHaveBeenCalledTimes(1);
    expect(handlers.onClearLineFilter).toHaveBeenCalledTimes(1);
  });

  it('keeps include and exclude submission controls distinct', () => {
    const handlers = props();
    const onSubmitLineFilter = jest.fn();
    render(<LineFilterEditor {...handlers} onSubmitLineFilter={onSubmitLineFilter} />);

    fireEvent.click(screen.getByTestId(ids.includeButton));
    expect(handlers.setExclusive).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByTestId(ids.excludeButton));
    expect(handlers.setExclusive).toHaveBeenLastCalledWith(true);
    expect(onSubmitLineFilter).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId(ids.operator)).not.toBeInTheDocument();
  });

  it('scopes repeated controls to stable filter keys, including after removal', () => {
    const renderRows = (keys: string[]) =>
      keys.map((key) => (
        <LineFilterVariable key={key} rowKey={key} isFirstLineFilterRow={false} onClick={jest.fn()} props={props()} />
      ));
    const { rerender } = render(<>{renderRows(['0', '2'])}</>);
    for (const key of ['0', '2']) {
      const row = within(screen.getByTestId(ids.row(key)));
      for (const id of [ids.operator, ids.regexToggle, ids.caseSensitivityToggle, ids.clearButton, ids.removeButton]) {
        expect(row.getAllByTestId(id)).toHaveLength(1);
      }
      expect(row.getByTestId(testIds.exploreServiceDetails.searchLogs)).toHaveValue('error');
    }
    rerender(<>{renderRows(['2', '3'])}</>);
    expect(screen.queryByTestId(ids.row('0'))).not.toBeInTheDocument();
    expect(screen.getAllByTestId(ids.row('2'))).toHaveLength(1);
    expect(screen.getAllByTestId(ids.row('3'))).toHaveLength(1);
  });
});
