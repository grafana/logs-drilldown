import React from 'react';

import { act, render, RenderResult, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// jest-canvas-mock prevents the combobox from breaking tests
import 'jest-canvas-mock';

import { DataSourceInstanceSettings } from '@grafana/data/dist/types/types/datasource';
import { getDataSourceSrv, locationService, LocationServiceProvider } from '@grafana/runtime';

import Config from './Config';
import { DefaultColumnsContextProvider } from './Context';
import {
  useCreateLogsDrilldownDefaultColumnsMutation,
  useGetLogsDrilldownDefaultColumnsQuery,
  useReplaceLogsDrilldownDefaultColumnsMutation,
} from 'lib/api-clients/logsdrilldown/v1alpha1';

// Constants
const DEBUG = true;
const MOCK_DS_UID = 'test-datasource-uid';
const COLUMN_1_DEFAULT_VALUE = 'column 1';
const COLUMN_2_DEFAULT_VALUE = 'column 2';
const ADD_COLUMN_BUTTON_TEXT = 'Add column';
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

describe('Config', () => {
  let result: RenderResult;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDataSourceSrv).mockReturnValue({
      getList: jest.fn().mockReturnValue(MOCK_DATA_SOURCES),
      get: jest.fn().mockReturnValue(MOCK_DATA_SOURCES[0]),
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
    beforeEach(() => {
      result = setup();
    });

    test('Shows loading UI', async () => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });
  describe('Exising record', () => {
    beforeEach(() => {
      jest.mocked(useGetLogsDrilldownDefaultColumnsQuery).mockReturnValue({
        isLoading: false,
        error: undefined,
        currentData: {
          spec: {
            records: [
              { columns: [COLUMN_1_DEFAULT_VALUE, COLUMN_2_DEFAULT_VALUE], labels: [{ key: 'key1', value: 'value1' }] },
            ],
          },
          metadata: {
            name: MOCK_DS_UID,
            resourceVersion: '1.0',
          },
        },
        refetch: jest.fn(),
      });
      result = setup();
    });

    test('Shows existing record', async () => {
      // record heading
      expect(screen.getByRole('heading', { name: /labels match/i })).toBeInTheDocument();

      // Label input
      expect(screen.getByPlaceholderText(SELECT_LABEL_NAME_PLACEHOLDER_TEXT)).toBeInTheDocument();
      expect(screen.getByPlaceholderText<HTMLInputElement>(SELECT_LABEL_NAME_PLACEHOLDER_TEXT).value).toBe('key1');

      // Value input
      expect(screen.getByPlaceholderText(SELECT_LABEL_VALUE_PLACEHOLDER_TEXT)).toBeInTheDocument();
      expect(screen.getByPlaceholderText<HTMLInputElement>(SELECT_LABEL_VALUE_PLACEHOLDER_TEXT).value).toBe('value1');

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
      expect(getLastAddLabelValueButton()).toBeDisabled();
      // typing into the combobox input via userEvents doesn't trigger onChange handlers, so there doesn't seem to be any way to test any interaction with the combobox and we'll have to write our tests by setting the initial state.
    });
  });

  test.todo('Deletes label');
  test.todo('Adds new column');
  test.todo('Deletes new column');
  test.todo('validation');
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
function getAddLabelButton() {
  return screen.getByRole<HTMLButtonElement>('button', { name: ADD_LABEL_BUTTON_TEXT });
}
// function getLastAddLabeNameButton() {
//   const inputs = screen.getAllByPlaceholderText<HTMLInputElement>(SELECT_LABEL_NAME_PLACEHOLDER_TEXT);
//   return inputs[inputs.length - 1];
// }
function getLastAddLabelValueButton() {
  const inputs = screen.getAllByPlaceholderText<HTMLInputElement>(SELECT_LABEL_VALUE_PLACEHOLDER_TEXT);
  return inputs[inputs.length - 1];
}
function setup(dsUID = MOCK_DS_UID) {
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
