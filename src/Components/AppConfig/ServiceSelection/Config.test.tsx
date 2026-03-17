import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

const mockGetQuery = jest.fn();
const mockCreateMutation = jest.fn();
const mockReplaceMutation = jest.fn();

jest.mock('@grafana/api-clients/rtkq/logsdrilldown/v1beta1', () => ({
  ...jest.requireActual('@grafana/api-clients/rtkq/logsdrilldown/v1beta1'),
  useGetLogsDrilldownDefaultLabelsQuery: (opts: { name: string }) => mockGetQuery(opts),
  useCreateLogsDrilldownDefaultLabelsMutation: () => [mockCreateMutation, { error: undefined }],
  useReplaceLogsDrilldownDefaultLabelsMutation: () => [mockReplaceMutation, { error: undefined }],
}));

jest.mock('services/labels', () => ({
  getLabelsForCombobox: jest.fn().mockResolvedValue([{ value: 'service' }, { value: 'namespace' }]),
  getLabelValuesForCombobox: jest.fn().mockResolvedValue([{ value: 'my-svc' }, { value: 'other-svc' }]),
}));

const defaultQueryReturn = {
  isLoading: false,
  error: undefined,
  currentData: {
    spec: { records: [] },
    metadata: { name: MOCK_DS_UID, resourceVersion: '1' },
  },
  isSuccess: true,
  refetch: jest.fn(),
};

function setupWithRecords(records: Array<{ label: string; values: string[] }> = []): ReturnType<typeof render> {
  mockGetQuery.mockReturnValue({
    ...defaultQueryReturn,
    currentData: {
      spec: { records },
      metadata: { name: MOCK_DS_UID, resourceVersion: '1' },
    },
  });
  return render(<Config />);
}

async function selectLabelAndAdd(labelName: string) {
  const labelInput = screen.getByPlaceholderText('Select label name');
  fireEvent.click(labelInput);
  await userEvent.type(labelInput, labelName);
  await userEvent.keyboard('{Enter}');
  const addButton = screen.getByRole('button', { name: /add label$/i });
  fireEvent.click(addButton);
}

async function selectLabelValuesAndAdd(labelName: string, values: string[]) {
  const labelInput = screen.getByPlaceholderText('Select label name');
  fireEvent.click(labelInput);
  await userEvent.type(labelInput, labelName);
  await userEvent.keyboard('{Enter}');
  const valuesInput = screen.getByPlaceholderText('Select values (optional)');
  for (const v of values) {
    fireEvent.click(valuesInput);
    await userEvent.type(valuesInput, v);
    await userEvent.keyboard('{Enter}');
  }
  // Button text is "Add label" or "Add label and values" depending on state
  const addButton = screen.getByRole('button', { name: /add label/i });
  fireEvent.click(addButton);
}

describe('ServiceSelection Config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSupported.isDefaultLabelsFlagsSupported = true;
    mockIsSupported.isDefaultLabelsVersionSupported = true;
    jest.mocked(getLastUsedDataSourceFromStorage).mockReturnValue(undefined);
    jest.mocked(getDefaultDatasourceFromDatasourceSrv).mockReturnValue(MOCK_DS_UID);
    mockGetQuery.mockReturnValue(defaultQueryReturn);
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

      expect(screen.getByRole('heading', { name: /landing page/i })).toBeInTheDocument();
      expect(screen.getByText(/landing page settings requires/i)).toBeInTheDocument();
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
      expect(screen.getByRole('heading', { name: /landing page default labels/i })).toBeInTheDocument();

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
      expect(screen.getByRole('heading', { name: /landing page default labels/i })).toBeInTheDocument();
      expect(getLastUsedDataSourceFromStorage).toHaveBeenCalled();
    });

    describe('integration: label and value selection, save, remove', () => {
      it('selects a label and shows Add label button', async () => {
        setupWithRecords([]);
        const labelInput = screen.getByPlaceholderText('Select label name');
        fireEvent.click(labelInput);
        await userEvent.type(labelInput, 'service');
        await userEvent.keyboard('{Enter}');

        expect(screen.getByRole('button', { name: /add label$/i })).toBeInTheDocument();
      });

      it('selects label and label values and adds them to the list', async () => {
        setupWithRecords([]);
        await selectLabelValuesAndAdd('service', ['my-svc', 'other-svc']);

        expect(screen.getByText('service')).toBeInTheDocument();
      });

      it('saves changes and calls replace mutation when records exist', async () => {
        setupWithRecords([{ label: 'service', values: [] }]);
        await selectLabelAndAdd('namespace');

        const saveButton = screen.getByRole('button', { name: /save changes/i });
        expect(saveButton).not.toBeDisabled();
        fireEvent.click(saveButton);

        expect(mockReplaceMutation).toHaveBeenCalledWith(
          expect.objectContaining({
            name: MOCK_DS_UID,
            logsDrilldownDefaultLabels: expect.objectContaining({
              spec: {
                records: expect.arrayContaining([
                  { label: 'service', values: [] },
                  { label: 'namespace', values: [] },
                ]),
              },
            }),
          })
        );
      });

      it('saves changes and calls create mutation when no record exists (404)', async () => {
        mockGetQuery.mockReturnValue({
          ...defaultQueryReturn,
          currentData: undefined,
          isSuccess: false,
          error: { status: 404 },
        });
        render(<Config />);
        await selectLabelAndAdd('service');

        const saveButton = screen.getByRole('button', { name: /save changes/i });
        fireEvent.click(saveButton);

        expect(mockCreateMutation).toHaveBeenCalledWith(
          expect.objectContaining({
            logsDrilldownDefaultLabels: expect.objectContaining({
              metadata: { name: MOCK_DS_UID },
              spec: { records: [{ label: 'service', values: [] }] },
            }),
          })
        );
      });

      it('removes a label from the list', async () => {
        setupWithRecords([
          { label: 'service', values: ['my-svc'] },
          { label: 'namespace', values: [] },
        ]);
        const removeServiceButton = screen.getByRole('button', { name: /remove service/i });
        fireEvent.click(removeServiceButton);

        expect(screen.queryByText('service')).not.toBeInTheDocument();
        expect(screen.getByText('namespace')).toBeInTheDocument();
      });

      it('removes a value from a label', async () => {
        setupWithRecords([{ label: 'service', values: ['my-svc', 'other-svc'] }]);
        // Expand the label row to show values (click the label text / collapse trigger)
        const labelHeader = screen.getByText('service');
        fireEvent.click(labelHeader);

        const removeMySvcButton = screen.getByRole('button', { name: /remove my-svc/i });
        fireEvent.click(removeMySvcButton);

        expect(screen.queryByText('my-svc')).not.toBeInTheDocument();
        expect(screen.getByText('other-svc')).toBeInTheDocument();
      });
    });
  });
});
