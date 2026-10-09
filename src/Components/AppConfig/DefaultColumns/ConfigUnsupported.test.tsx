import React, { ReactNode } from 'react';

import { render, RenderResult, screen } from '@testing-library/react';

import { DataSourceInstanceListItem } from '@grafana/data';
import { getDataSourceInstanceList, getDefaultDataSourceInstanceListItem } from '@grafana/plugin-compat/datasources';

import Config from './Config';

jest.mock('Components/FeatureFlagContext', () => ({
  FeatureFlagContext: ({ children }: { children: ReactNode }) => children,
}));

const debug = false;

jest.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstanceList: jest.fn(),
  getDefaultDataSourceInstanceListItem: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    buildInfo: {
      ...jest.requireActual('@grafana/runtime').config.buildInfo,
      version: '11.6',
    },
  },
}));

const dataSources: Array<Partial<DataSourceInstanceListItem>> = [
  {
    uid: 'test-datasource-uid',
    type: '',
    name: '',
  },
];

jest.mock('semver/preload', () => ({
  ...jest.requireActual('semver/preload'),
  ltr: () => true,
}));

describe('Config', () => {
  let result: RenderResult;
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.mocked(getDataSourceInstanceList).mockResolvedValue(dataSources as DataSourceInstanceListItem[]);
    jest.mocked(getDefaultDataSourceInstanceListItem).mockResolvedValue(dataSources[0] as DataSourceInstanceListItem);
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
      expect(await screen.findByRole('heading', { name: /default columns/i })).toBeInTheDocument();
      expect(screen.getByText(/default columns requires grafana 12\.4 or greater\./i)).toBeInTheDocument();
    });

    test('Shows unsupported if missing feature flags', async () => {
      result = render(<Config />);
      expect(await screen.findByText(/default columns requires.+feature flag to be enabled\./i)).toBeInTheDocument();
      expect(screen.getByText('kubernetesLogsDrilldown')).toBeInTheDocument();
    });
  });
});
