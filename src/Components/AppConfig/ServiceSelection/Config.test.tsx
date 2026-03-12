import React from 'react';

import { render, screen } from '@testing-library/react';

// jest-canvas-mock prevents Combobox from breaking tests
import 'jest-canvas-mock';

import Config from './Config';
import { getDefaultDatasourceFromDatasourceSrv, getLastUsedDataSourceFromStorage } from 'services/store';

const MOCK_DS_UID = 'test-datasource-uid';
const DEBUG = false;

const mockIsSupported = {
  isDefaultLabelsFlagsSupported: true,
  isDefaultLabelsVersionSupported: true,
};
jest.mock('./isSupported', () => ({
  get isDefaultLabelsSupported() {
    return mockIsSupported.isDefaultLabelsFlagsSupported && mockIsSupported.isDefaultLabelsVersionSupported;
  },
  get isDefaultLabelsVersionSupported() {
    return mockIsSupported.isDefaultLabelsVersionSupported;
  },
  get isDefaultLabelsFlagsSupported() {
    return mockIsSupported.isDefaultLabelsFlagsSupported;
  },
}));

jest.mock('services/store');

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  const lokiDsSettings = {
    uid: 'test-datasource-uid',
    id: 1,
    isDefault: true,
    type: 'loki',
    name: 'Test Loki',
    readOnly: false,
    jsonData: {},
    access: 'direct',
    meta: { info: { logos: { small: '' } } },
  };
  const srv = {
    getList: () => [lokiDsSettings],
    get: jest.fn().mockResolvedValue(lokiDsSettings),
    getInstanceSettings: jest.fn((uid: string) => (uid === lokiDsSettings.uid ? lokiDsSettings : undefined)),
  };
  // DataSourcePicker reads getDataSourceSrv() from the runtime's dataSourceSrv singleton.
  // Set it so the real component gets our mock.
  actual.setDataSourceSrv(srv);
  actual.config = {
    ...actual.config,
    featureToggles: { ...actual.config.featureToggles, kubernetesLogsDrilldown: true },
    buildInfo: { ...actual.config.buildInfo, version: '13.0.0' },
  };
  return actual;
});

jest.mock('@grafana/api-clients/rtkq/logsdrilldown/v1beta1', () => ({
  ...jest.requireActual('@grafana/api-clients/rtkq/logsdrilldown/v1beta1'),
  useGetLogsDrilldownDefaultLabelsQuery: jest.fn().mockReturnValue({
    isLoading: false,
    error: undefined,
    currentData: {
      spec: { records: [] },
      metadata: { name: 'test-datasource-uid', resourceVersion: '1' },
    },
    isSuccess: true,
    refetch: jest.fn(),
  }),
  useCreateLogsDrilldownDefaultLabelsMutation: jest.fn().mockReturnValue([jest.fn(), { error: undefined }]),
  useReplaceLogsDrilldownDefaultLabelsMutation: jest.fn().mockReturnValue([jest.fn(), { error: undefined }]),
}));
jest.mock('services/labels');

describe('ServiceSelection Config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSupported.isDefaultLabelsFlagsSupported = true;
    mockIsSupported.isDefaultLabelsVersionSupported = true;
    jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue(undefined);
    jest.mocked(getDefaultDatasourceFromDatasourceSrv).mockReturnValue(MOCK_DS_UID);
  });

  afterEach(() => {
    if (DEBUG) {
      screen.logTestingPlaygroundURL();
    }
  });

  describe('when no datasource is available', () => {
    it('shows NoLokiSplash', () => {
      jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue(undefined);
      jest.mocked(getDefaultDatasourceFromDatasourceSrv).mockReturnValue(undefined);

      render(<Config />);

      expect(screen.getByRole('heading', { name: /welcome to grafana logs drilldown/i })).toBeInTheDocument();
      expect(screen.getByText(/no loki datasource configured/i)).toBeInTheDocument();
    });
  });

  describe('when feature is not supported', () => {
    it('shows Unsupported with Service Selection heading and requirement message', () => {
      mockIsSupported.isDefaultLabelsFlagsSupported = false;

      render(<Config />);

      expect(screen.getByRole('heading', { name: /service selection/i })).toBeInTheDocument();
      expect(screen.getByText(/service selection settings requires/i)).toBeInTheDocument();
      expect(screen.getByText(/kubernetesLogsDrilldown/)).toBeInTheDocument();
    });
  });

  describe('when datasource and feature are supported', () => {
    it('renders main config with Beta badge and intro text', () => {
      render(<Config />);

      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(
        screen.getByText(
          /configure which labels and label values appear by default on the logs drilldown landing page/i
        )
      ).toBeInTheDocument();
    });

    it('renders ServiceSelectionContextProvider with DataSource, DefaultLabels and Footer', () => {
      render(<Config />);

      // DefaultLabels section
      expect(screen.getByRole('heading', { name: /service selection default labels/i })).toBeInTheDocument();

      // Footer actions
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });

    it('prefers last used datasource from storage over default from service', () => {
      const storedUID = 'stored-ds-uid';
      jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue(storedUID);
      jest.mocked(getDefaultDatasourceFromDatasourceSrv).mockReturnValue(MOCK_DS_UID);

      render(<Config />);

      // Config renders main content (would use stored UID in context)
      expect(screen.getByRole('heading', { name: /service selection default labels/i })).toBeInTheDocument();
      expect(getLastUsedDataSourceFromStorage).toHaveBeenCalled();
    });
  });
});
