export const testIds = {
  appConfig: {
    apiKey: 'data-testid ac-api-key',
    apiUrl: 'data-testid ac-api-url',
    container: 'data-testid ac-container',
    submit: 'data-testid ac-submit-form',
  },
  breakdowns: {
    common: {
      filterButton: 'data-testid filter-button',
      filterButtonGroup: 'data-testid filter-button-group',
      filterNumericPopover: {
        cancelButton: 'data-testid filter-numeric-cancel',
        inputGreaterThan: 'data-testid filter-numeric-gt',
        inputGreaterThanInclusive: 'data-testid filter-numeric-gte',
        inputGreaterThanUnit: 'data-testid filter-numeric-gtu',
        inputLessThan: 'data-testid filter-numeric-lt',
        inputLessThanInclusive: 'data-testid filter-numeric-lte',

        inputLessThanUnit: 'data-testid filter-numeric-ltu',
        removeButton: 'data-testid filter-numeric-remove',
        submitButton: 'data-testid filter-numeric-submit',
      },
      filterSelect: 'data-testid filter-select',
      sortByDirection: 'data-testid SortBy direction',
      sortByFunction: 'data-testid SortBy function',
    },
    fields: {},
    labels: {},
  },
  exploreServiceDetails: {
    buttonFilterExclude: 'data-testid button-filter-exclude',
    buttonFilterInclude: 'data-testid button-filter-include',
    buttonRemovePattern: 'data-testid button-remove-pattern',
    openExplore: 'data-testid open-explore',
    searchLogs: 'data-testid search-logs',
    tabFields: 'data-testid tab-fields',
    tabLabels: 'data-testid tab-labels',
    tabLogs: 'data-testid tab-logs',
    tabPatterns: 'data-testid tab-patterns',
  },
  exploreServiceSearch: {
    search: 'data-testid search-services',
  },
  header: {
    refreshPicker: 'data-testid RefreshPicker run button',
  },

  index: {
    addNewLabelTab: 'data-testid Tab Add label',
    aggregatedMetricsMenu: 'data-testid aggregated-metrics-menu',
    aggregatedMetricsToggle: 'data-testid aggregated-metrics-toggle',
    header: {
      showLogsButton: 'data-testid Show logs header',
    },
    searchLabelValueInput: 'data-testid search-services-input',
    selectServiceButton: 'data-testid button-select-service',
    showLogsButton: 'data-testid button-filter-include',
  },

  logsPanelHeader: {
    header: 'data-testid Panel header Logs',
    radio: 'data-testid radio-button',
  },
  patterns: {
    buttonExcludedPattern: 'data-testid button-excluded-pattern',
    buttonIncludedPattern: 'data-testid button-included-pattern',
    tableWrapper: 'data-testid table-wrapper',
  },
  table: {
    inspectLine: 'data-testid inspect',
    rawLogLine: 'data-testid raw-log-line',
    wrapper: 'data-testid table-wrapper',
  },
  variables: {
    combobox: {},
    datasource: {
      label: 'data-testid Dashboard template variables submenu Label Data source',
    },
    levels: {
      inputWrap: 'data-testid detected_level filter variable',
    },
    serviceName: {
      label: 'data-testid Dashboard template variables submenu Label Labels',
    },
  },
};
