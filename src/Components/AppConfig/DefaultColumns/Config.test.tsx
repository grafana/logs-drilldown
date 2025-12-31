import React from 'react';

import { act, render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// jest-canvas-mock prevents the combobox from breaking tests
import 'jest-canvas-mock';

import { DataSourceInstanceSettings } from '@grafana/data/dist/types/types/datasource';
import { DataSourceWithBackend, getDataSourceSrv, locationService, LocationServiceProvider } from '@grafana/runtime';

import Config from './Config';
import { DefaultColumnsContextProvider } from './Context';
import { LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords } from './types';
import {
  useCreateLogsDrilldownDefaultColumnsMutation,
  useGetLogsDrilldownDefaultColumnsQuery,
  useReplaceLogsDrilldownDefaultColumnsMutation,
} from 'lib/api-clients/logsdrilldown/v1alpha1';

// Constants
const DEBUG = false;
const MOCK_DS_UID = 'test-datasource-uid';
const COLUMN_1_DEFAULT_VALUE = 'column 1';
const COLUMN_2_DEFAULT_VALUE = 'column 2';
const ADD_COLUMN_BUTTON_TEXT = 'Add column';
const REMOVE_COLUMN_BUTTON_TEXT_MATCH = /^Remove/;
const SELECT_COLUMNS_INPUT_PLACEHOLDER = 'Select column';
const LOGS_SCENE_MOCK_TEXT = 'LogsSceneMock';
const DS_SELECTOR_MOCK_TEXT = 'DSMock';
const DELETE_RECORD_BUTTON_TEXT = 'Delete record';
const UPDATE_BUTTON_TEXT = 'Update default columns';
const RESET_BUTTON_TEXT = 'Reset';
const ADD_LABEL_BUTTON_TEXT = 'Add label';
const SELECT_LABEL_NAME_PLACEHOLDER_TEXT = 'Select label name';
const SELECT_LABEL_VALUE_PLACEHOLDER_TEXT = 'Select label value';
const MOCK_DATA_SOURCES: Array<Partial<DataSourceInstanceSettings>> = [
  {
    uid: MOCK_DS_UID,
    id: 1,
    isDefault: true,
    type: '',
    name: '',
    readOnly: false,
    jsonData: {},
    access: 'direct',
  },
];
// Mocks
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn().mockReturnValue({
    getList: () => jest.fn().mockReturnValue(MOCK_DATA_SOURCES),
    get: () => jest.fn().mockReturnValue(MOCK_DATA_SOURCES[0]),
  }),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    featureToggles: {
      kubernetesLogsDrilldown: true,
      grafanaAPIServerWithExperimentalAPIs: true,
    },
    buildInfo: {
      ...jest.requireActual('@grafana/runtime').config.buildInfo,
      version: '12.4.0-20299387718.patch2',
    },
  },
}));

jest.mock('lib/api-clients/logsdrilldown/v1alpha1', () => ({
  ...jest.requireActual('lib/api-clients/logsdrilldown/v1alpha1'),
  useGetLogsDrilldownDefaultColumnsQuery: jest.fn(),
  useCreateLogsDrilldownDefaultColumnsMutation: jest.fn(),
  useReplaceLogsDrilldownDefaultColumnsMutation: jest.fn(),
}));

jest.mock('./LogsScene', () => ({
  LogsScene: () => {
    return <>{LOGS_SCENE_MOCK_TEXT}</>;
  },
}));

jest.mock('./DataSource', () => ({
  DataSource: () => {
    return <>{DS_SELECTOR_MOCK_TEXT}</>;
  },
}));

jest.mock('services/TagKeysProviders', () => ({
  getLabelsKeys: () => Promise.resolve([{ text: 'labelName1' }, { text: 'labelName2' }]),
}));

jest.mock('services/TagValuesProviders', () => ({
  getLabelValues: () => Promise.resolve([{ text: 'labelValue1' }, { text: 'labelValue2' }]),
}));

describe('Config', () => {
  let result: RenderResult;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDataSourceSrv).mockReturnValue({
      getList: jest.fn().mockReturnValue(MOCK_DATA_SOURCES),
      get: jest.fn().mockReturnValue(new DataSourceWithBackend(MOCK_DATA_SOURCES[0] as DataSourceInstanceSettings)),
    } as any);
    jest.mocked(useGetLogsDrilldownDefaultColumnsQuery).mockReturnValue({
      isLoading: true,
      error: undefined,
      currentData: undefined,
      refetch: jest.fn(),
    });
    jest.mocked(useCreateLogsDrilldownDefaultColumnsMutation).mockReturnValue([() => {}, { error: undefined }] as any);
    jest.mocked(useReplaceLogsDrilldownDefaultColumnsMutation).mockReturnValue([() => {}, { error: undefined }] as any);
  });

  afterEach(() => {
    // Generate testing URL
    if (DEBUG) {
      screen.logTestingPlaygroundURL(result.baseElement);
    }
  });

  describe('No records', () => {
    test('Shows loading UI', async () => {
      result = setup([], true);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });
  describe('Existing record', () => {
    beforeEach(() => {
      result = setup();
    });

    test('Shows existing record', async () => {
      // record heading
      expect(screen.getByRole('heading', { name: /labels match/i })).toBeInTheDocument();

      // Label input
      expect(screen.getAllByPlaceholderText(SELECT_LABEL_NAME_PLACEHOLDER_TEXT)[0]).toBeInTheDocument();
      expect(screen.getAllByPlaceholderText<HTMLInputElement>(SELECT_LABEL_NAME_PLACEHOLDER_TEXT)[0].value).toBe(
        'key1'
      );

      // Value input
      expect(screen.getAllByPlaceholderText(SELECT_LABEL_VALUE_PLACEHOLDER_TEXT)[0]).toBeInTheDocument();
      expect(screen.getAllByPlaceholderText<HTMLInputElement>(SELECT_LABEL_VALUE_PLACEHOLDER_TEXT)[0].value).toBe(
        'value1'
      );

      // Add label button
      expect(getAddLabelButton()).toBeInTheDocument();
      expect(getAddLabelButton().disabled).toBe(false);

      // Displayed columns
      expect(getDisplayColumns()).toBeInTheDocument();
      expect(screen.getByText(COLUMN_1_DEFAULT_VALUE)).toBeInTheDocument();
      expect(screen.getByText(COLUMN_2_DEFAULT_VALUE)).toBeInTheDocument();

      // Delete record button
      expect(getDeleteRecordButton()).toBeInTheDocument();
    });
    test('Expands columns section', async () => {
      expect(getDisplayColumns()).toBeInTheDocument();

      expect(screen.queryByDisplayValue(COLUMN_1_DEFAULT_VALUE)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: `Remove ${COLUMN_1_DEFAULT_VALUE}` })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: ADD_COLUMN_BUTTON_TEXT })).not.toBeInTheDocument();
      expect(screen.queryByText(LOGS_SCENE_MOCK_TEXT)).not.toBeInTheDocument();
      act(() => {
        getDisplayColumns()?.click();
      });
      expect(screen.getByDisplayValue(COLUMN_1_DEFAULT_VALUE)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Remove ${COLUMN_1_DEFAULT_VALUE}` })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: ADD_COLUMN_BUTTON_TEXT })).toBeInTheDocument();
      expect(screen.getByText(LOGS_SCENE_MOCK_TEXT)).toBeInTheDocument();
    });
    test('Can delete record', async () => {
      expect(getDisplayColumns()).toBeInTheDocument();
      expect(getDeleteRecordButton()).toBeInTheDocument();
      // No changes have been made, so we can't submit (note, the classic button doesn't set the disabled attribute, but it does set the aria-disabled, the ConfirmButton has the opposite behavior
      expect(getSubmitButton()).toHaveAttribute('aria-disabled', 'true');
      expect(getResetButton()).toBeDisabled();
      act(() => {
        getDeleteRecordButton()?.click();
      });
      expect(getDeleteRecordButton()).not.toBeInTheDocument();
      expect(getDisplayColumns()).not.toBeInTheDocument();
      // Now we have pending changes, so the submit button should be enabled
      expect(getSubmitButton()).toHaveAttribute('aria-disabled', 'false');
      expect(getResetButton()).not.toBeDisabled();
    });
    test('Labels are disabled', async () => {
      // No changes have been made, so we can't submit
      expect(getSubmitButton()).toHaveAttribute('aria-disabled', 'true');
      expect(getResetButton()).toBeDisabled();
      act(() => {
        getAddLabelButton()?.click();
      });
      // We made changes, so we can revert
      expect(getResetButton()).not.toBeDisabled();
      // But until the options are filled in we can't submit the changes
      expect(getSubmitButton()).toHaveAttribute('aria-disabled', 'true');
      // Combobox doesn't set attributes for invalid/aria-invalid, so screen readers (and tests) don't have any way to know when an input is invalid
      // expect(getLastAddLabeNameButton()).toBeInvalid();
      expect(getLastAddLabelValueInput()).toBeDisabled();

      expect(getLastAddLabelNameInput()).toHaveValue('');
      expect(getLastAddLabelValueInput()).toHaveValue('');
    });
    test('Deletes label', () => {
      // Remove button shows for each label
      expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(2);
      act(() => {
        screen.getByRole('button', { name: /remove key2 = value2/i }).click();
      });
      // Cannot delete the last label
      expect(screen.queryAllByRole('button', { name: /remove/i })).toHaveLength(0);
    });
    test('Adds new column', () => {
      // Columns show up in the expanded section header
      expect(screen.getByText(COLUMN_1_DEFAULT_VALUE)).toBeInTheDocument();
      expect(screen.getByText(COLUMN_2_DEFAULT_VALUE)).toBeInTheDocument();

      // Expand the columns
      act(() => {
        getDisplayColumns()?.click();
      });

      expect(screen.getByRole('button', { name: ADD_COLUMN_BUTTON_TEXT })).toBeInTheDocument();
      expect(getColumnInputs()).toHaveLength(2);
      expect(getResetButton()).toBeDisabled();

      act(() => {
        screen.getByRole('button', { name: ADD_COLUMN_BUTTON_TEXT }).click();
      });

      // We should have 3 columns now after adding one
      expect(getColumnInputs()).toHaveLength(3);
      // Submit button should be disabled as our record is not valid
      expect(getSubmitButton()).toHaveAttribute('aria-disabled', 'true');
      expect(getResetButton()).not.toBeDisabled();
    });
    test('Deletes new column', () => {
      // Should be 2 remove buttons for labels
      expect(getRemoveButtons()).toHaveLength(2);
      // Open columns drawer
      act(() => {
        getDisplayColumns()?.click();
      });
      // Now we can see 2 more remove buttons
      expect(getRemoveButtons()).toHaveLength(4);
      // Remove an existing column
      act(() => {
        getRemoveButtons()[getRemoveButtons().length - 1].click();
      });
      // Since you can't remove the last item, now we have 2
      expect(getRemoveButtons()).toHaveLength(2);
    });
  });
  describe('Validation', () => {
    it('Cannot save empty state', () => {
      result = setup([]);
      expect(getSubmitButton()).toHaveAttribute('aria-disabled', 'true');
      expect(getResetButton()).toBeDisabled();
    });
    it('Can revert pending label changes', async () => {
      result = setup();
      expect(getSubmitButton()).toHaveAttribute('aria-disabled', 'true');
      expect(getResetButton()).toBeDisabled();
      act(() => {
        getAddLabelButton()?.click();
      });
      expect(getResetButton()).not.toBeDisabled();
      expect(getSubmitButton()).toHaveAttribute('aria-disabled', 'true');

      await addCustomValueToCombobox(getLastAddLabelNameInput(), 'foo');
      expect(screen.getByDisplayValue(/foo/i)).toBeInTheDocument();

      expect(getResetButton()).not.toBeDisabled();
      expect(getSubmitButton()).toHaveAttribute('aria-disabled', 'true');

      await addCustomValueToCombobox(getLastAddLabelValueInput(), 'bar');
      expect(screen.getByDisplayValue(/bar/i)).toBeInTheDocument();

      expect(getResetButton()).not.toBeDisabled();
      expect(getSubmitButton()).toHaveAttribute('aria-disabled', 'false');
      expect(screen.getByDisplayValue(/bar/i)).toBeInTheDocument();

      act(() => {
        getResetButton().click();
        getResetButton().click();
        getResetButtons()[1].click();
      });

      expect(screen.queryByDisplayValue(/foo/i)).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue(/bar/i)).not.toBeInTheDocument();

      expect(getResetButton()).toBeDisabled();
      expect(getSubmitButton()).toHaveAttribute('aria-disabled', 'true');
    });
    it('Can revert pending column changes', async () => {
      result = setup();
      act(() => {
        getDisplayColumns()?.click();
      });
      expect(getColumnInputs()).toHaveLength(2);
      expect(getResetButton()).toBeDisabled();
      expect(getSubmitButton()).toHaveAttribute('aria-disabled', 'true');
      act(() => {
        screen.getByRole('button', { name: ADD_COLUMN_BUTTON_TEXT }).click();
      });
      expect(getColumnInputs()).toHaveLength(3);
      expect(getResetButton()).not.toBeDisabled();
      expect(getSubmitButton()).toHaveAttribute('aria-disabled', 'true');
      await addCustomValueToCombobox(getColumnInputs()[getColumnInputs().length - 1], 'foo');
      expect(getSubmitButton()).toHaveAttribute('aria-disabled', 'false');
    });
  });
});

function getDisplayColumns() {
  return screen.queryByRole('heading', { name: /display columns/i });
}
function getDeleteRecordButton() {
  return screen.queryByRole<HTMLButtonElement>('button', { name: DELETE_RECORD_BUTTON_TEXT });
}
function getSubmitButton() {
  return screen.getByRole<HTMLButtonElement>('button', { name: UPDATE_BUTTON_TEXT });
}
function getResetButton() {
  return screen.queryAllByRole<HTMLButtonElement>('button', { name: RESET_BUTTON_TEXT })[0];
}
function getResetButtons() {
  return screen.getAllByText('Reset');
}
function getAddLabelButton() {
  return screen.getByRole<HTMLButtonElement>('button', { name: ADD_LABEL_BUTTON_TEXT });
}
function getLastAddLabelNameInput() {
  const inputs = screen.getAllByPlaceholderText<HTMLInputElement>(SELECT_LABEL_NAME_PLACEHOLDER_TEXT);
  return inputs[inputs.length - 1];
}
function getLastAddLabelValueInput() {
  const inputs = screen.getAllByPlaceholderText<HTMLInputElement>(SELECT_LABEL_VALUE_PLACEHOLDER_TEXT);
  return inputs[inputs.length - 1];
}
function getRemoveButtons() {
  return screen.queryAllByRole<HTMLButtonElement>('button', { name: REMOVE_COLUMN_BUTTON_TEXT_MATCH });
}
function getColumnInputs() {
  return screen.getAllByPlaceholderText<HTMLInputElement>(SELECT_COLUMNS_INPUT_PLACEHOLDER);
}
async function addCustomValueToCombobox(comboBox: HTMLInputElement, value = 'foo') {
  act(() => {
    comboBox.click();
  });
  await act(async () => {
    await userEvent.type(comboBox, value);
  });
  await act(async () => {
    await userEvent.keyboard('{Enter}');
  });
}
function setup(records?: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords, isLoading = false) {
  const dsUID = 'dsID';
  jest.mocked(useGetLogsDrilldownDefaultColumnsQuery).mockReturnValue({
    isLoading,
    error: undefined,
    currentData: {
      spec: {
        records: records ?? [
          {
            columns: [COLUMN_1_DEFAULT_VALUE, COLUMN_2_DEFAULT_VALUE],
            labels: [
              { key: 'key1', value: 'value1' },
              { key: 'key2', value: 'value2' },
            ],
          },
        ],
      },
      metadata: {
        name: MOCK_DS_UID,
        resourceVersion: '1.0',
      },
    },
    refetch: jest.fn(),
  });
  return render(
    <LocationServiceProvider service={locationService}>
      <MemoryRouter initialEntries={[{ pathname: '/' }]}>
        <DefaultColumnsContextProvider initialDSUID={dsUID}>
          <Config />
        </DefaultColumnsContextProvider>
      </MemoryRouter>
    </LocationServiceProvider>
  );
}
