import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdHocFiltersVariable, AdHocFilterWithLabels } from '@grafana/scenes';

import { FieldFilterConnectors } from './FieldFilterConnectors';
import { getFilterOrGroup, setFilterOrGroup } from 'services/fieldFilterOrGroups';
import { FilterOp } from 'services/filterTypes';
import { testIds } from 'services/testIds';
import { VAR_FIELDS_AND_METADATA } from 'services/variables';

jest.mock('services/analytics', () => ({
  ...jest.requireActual('services/analytics'),
  reportAppInteraction: jest.fn(),
}));
jest.mock('services/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const parsedField = (key: string, value: string): AdHocFilterWithLabels => ({
  key,
  operator: FilterOp.Equal,
  value: JSON.stringify({ parser: 'logfmt', value }),
  valueLabels: [value],
});

function renderConnectors(filters: AdHocFilterWithLabels[]) {
  const variable = new AdHocFiltersVariable({ filters, layout: 'combobox', name: VAR_FIELDS_AND_METADATA });
  render(
    <FieldFilterConnectors variable={variable}>
      <variable.Component model={variable} />
    </FieldFilterConnectors>
  );
  return variable;
}

describe('FieldFilterConnectors', () => {
  it('renders a connector between each pair of filter pills', async () => {
    renderConnectors([
      setFilterOrGroup(parsedField('status', '500'), 1),
      setFilterOrGroup(parsedField('duration', '5s'), 1),
      parsedField('pod', 'a'),
    ]);

    await waitFor(() => expect(screen.getAllByTestId(testIds.variables.fields.filterConnector)).toHaveLength(2));
    const connectors = screen.getAllByTestId(testIds.variables.fields.filterConnector);
    expect(connectors.map((connector) => connector.textContent)).toEqual(['or', 'and']);

    const pills = ['status', 'duration', 'pod'].map((key) => screen.getByText(new RegExp(`^${key} = `)));
    const inDocumentOrder = [pills[0], connectors[0], pills[1], connectors[1], pills[2]];
    inDocumentOrder.slice(1).forEach((element, index) => {
      const previous = inDocumentOrder[index];
      expect(previous?.compareDocumentPosition(element) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  it('toggles the OR group when a connector is clicked', async () => {
    const variable = renderConnectors([parsedField('status', '500'), parsedField('duration', '5s')]);

    await userEvent.click(await screen.findByRole('button', { name: /Click to require either \(OR\)/ }));
    expect(variable.state.filters.map(getFilterOrGroup)).toEqual([1, 1]);
    await waitFor(() => expect(screen.getByTestId(testIds.variables.fields.filterConnector)).toHaveTextContent('or'));

    await userEvent.click(screen.getByRole('button', { name: /Click to require both \(AND\)/ }));
    expect(variable.state.filters.map(getFilterOrGroup)).toEqual([undefined, undefined]);
  });

  it('removes connectors when filters are removed', async () => {
    const variable = renderConnectors([parsedField('status', '500'), parsedField('duration', '5s')]);
    await waitFor(() => expect(screen.getAllByTestId(testIds.variables.fields.filterConnector)).toHaveLength(1));

    variable.updateFilters([parsedField('status', '500')]);

    await waitFor(() => expect(screen.queryByTestId(testIds.variables.fields.filterConnector)).not.toBeInTheDocument());
  });
});
