import React from 'react';

import { render, RenderResult, screen } from '@testing-library/react';

// jest-canvas-mock prevents the combobox from breaking tests
import 'jest-canvas-mock';

import { DataSourceInstanceSettings } from '@grafana/data/dist/types/types/datasource';
import { getDataSourceSrv } from '@grafana/runtime';

import { useGetLogsDrilldownDefaultColumnsQuery } from '../../../lib/api-clients/logsdrilldown/v1alpha1';
import { DefaultColumnsContextProvider } from './Context';
import { DefaultColumns } from './DefaultColumns';

const debug = true;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

jest.mock('lib/api-clients/logsdrilldown/v1alpha1', () => ({
  ...jest.requireActual('lib/api-clients/logsdrilldown/v1alpha1'),
  useGetLogsDrilldownDefaultColumnsQuery: jest.fn(),
}));

const dataSources: Array<Partial<DataSourceInstanceSettings>> = [
  {
    uid: 'test-datasource-uid',
    id: 1,
    isDefault: true,
    type: '',
    name: '',
    readOnly: false,
    jsonData: {},
    access: 'direct',
  },
];

describe('DefaultColumns', () => {
  let result: RenderResult;
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Generate testing URL
    if (debug) {
      screen.logTestingPlaygroundURL(result.baseElement);
    }
  });

  test('Shows loading UI', async () => {
    jest.mocked(useGetLogsDrilldownDefaultColumnsQuery).mockReturnValue({
      isLoading: true,
      error: undefined,
      currentData: undefined,
      refetch: jest.fn(),
    });
    result = render(
      <DefaultColumnsContextProvider initialDSUID={'dsUID'}>
        <DefaultColumns />
      </DefaultColumnsContextProvider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('Shows existing record', async () => {
    const dsUID = 'dsUID';
    jest.mocked(getDataSourceSrv).mockReturnValue({
      getList: jest.fn().mockReturnValue(dataSources),
      get: jest.fn().mockReturnValue(dataSources[0]),
    } as any);
    jest.mocked(useGetLogsDrilldownDefaultColumnsQuery).mockReturnValue({
      isLoading: false,
      error: undefined,
      currentData: {
        spec: {
          records: [{ columns: ['column 1', 'column 2'], labels: [{ key: 'key1', value: 'value1' }] }],
        },
        metadata: {
          name: dsUID,
          resourceVersion: '1.0',
        },
      },
      refetch: jest.fn(),
    });
    result = render(
      <DefaultColumnsContextProvider initialDSUID={dsUID}>
        <DefaultColumns />
      </DefaultColumnsContextProvider>
    );

    // record heading
    expect(screen.getByRole('heading', { name: /labels match/i })).toBeInTheDocument();

    // Label input
    expect(screen.getByPlaceholderText(/select label name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText<HTMLInputElement>(/select label name/i).value).toBe('key1');

    // Value input
    expect(screen.getByPlaceholderText(/select label value/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText<HTMLInputElement>(/select label value/i).value).toBe('value1');

    // Add label button
    expect(screen.getByRole('button', { name: /add label/i })).toBeInTheDocument();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /add label/i }).disabled).toBe(false);

    // Displayed columns
    expect(screen.getByRole('heading', { name: /display columns/i })).toBeInTheDocument();
    expect(screen.getByText('column 1')).toBeInTheDocument();
    expect(screen.getByText('column 2')).toBeInTheDocument();

    // Delete record button
    expect(screen.getByRole('button', { name: /delete record/i })).toBeInTheDocument();
  });
  test.todo('Expands columns section');
  test.todo('Adds new label');
  test.todo('Deletes label');
  test.todo('Adds new column');
  test.todo('Deletes new column');
  test.todo('validation');
});
