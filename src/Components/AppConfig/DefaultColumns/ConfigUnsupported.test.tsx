import React from 'react';

import { render, RenderResult, screen } from '@testing-library/react';

import { DataSourceInstanceSettings } from '@grafana/data/dist/types/types/datasource';
import { getDataSourceSrv } from '@grafana/runtime';

import Config from './Config';

const debug = false;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    buildInfo: {
      ...jest.requireActual('@grafana/runtime').config.buildInfo,
      version: '11.6',
    },
  },
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

describe('Config', () => {
  let result: RenderResult;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDataSourceSrv).mockReturnValue({
      getList: jest.fn().mockReturnValue(dataSources),
    } as any);
  });

  afterEach(() => {
    // Generate testing URL
    if (debug) {
      screen.logTestingPlaygroundURL(result.baseElement);
    }
  });

  describe('Shows installation instructions if requirements are not met', () => {
    test('Shows unsupported if Grafana < 12.4', async () => {
      result = render(<Config />);
      expect(screen.getByRole('heading', { name: /default columns/i })).toBeInTheDocument();
      expect(screen.getByText(/default columns requires grafana 12\.4 or greater\./i)).toBeInTheDocument();
    });

    test('Shows unsupported if missing feature flags', async () => {
      result = render(<Config />);
      expect(screen.getByText(/default columns requires and feature flags to be enabled\./i)).toBeInTheDocument();
      expect(screen.getByText('kubernetesLogsDrilldown')).toBeInTheDocument();
    });
  });
});
