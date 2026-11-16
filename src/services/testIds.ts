export const testIds = {
  appConfig: {
    apiKey: 'data-testid ac-api-key',
    apiUrl: 'data-testid ac-api-url',
    container: 'data-testid ac-container',
    submit: 'data-testid ac-submit-form',
    defaultColumns: {
      labels: {
        key: 'data-testid ac-dc-label-name-input',
        value: 'ac-dc-labels-value-input',
      },
    },
  },
  breakdowns: {
    common: {
      displayVolumeLabel: 'data-testid display-volume-label',
      displayVolumeToggle: 'data-testid display-volume-toggle',
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
      layoutSwitcher: 'data-testid layout-switcher',
      /** Primary CTAs that drill into label/field value breakdown (Labels & Fields tabs). */
      selectValueBreakdown: 'data-testid breakdown-select-value',
      sortByDirection: 'data-testid SortBy direction',
      sortByFunction: 'data-testid SortBy function',
      toolbar: 'data-testid breakdown-toolbar',
    },
    labelFieldSearch: 'data-testid search-label-field',
    fields: {
      extractFieldsLabel: 'data-testid extract-fields-label',
      extractFieldsToggle: 'data-testid extract-fields-toggle',
    },
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
    pluginHeaderToolbar: 'data-testid plugin-header-toolbar',
    pluginInfoButton: 'data-testid plugin-info-button',
    refreshPicker: 'data-testid RefreshPicker run button',
  },

  index: {
    addNewLabelTab: 'data-testid Tab Add label tab',
    aggregatedMetricsMenu: 'data-testid aggregated-metrics-menu',
    aggregatedMetricsToggle: 'data-testid aggregated-metrics-toggle',
    header: {
      showLogsButton: 'data-testid Show logs header',
    },
    searchLabelValueInput: 'data-testid search-services-input',
    selectServiceButton: 'data-testid button-select-service',
    serviceSelection: (labelName: string, labelValue: string) =>
      `data-testid service-selection-${encodeURIComponent(labelName)}:${encodeURIComponent(labelValue)}`,
  },

  logsPanelHeader: {
    header: 'data-testid Panel header Logs',
    radio: 'data-testid radio-button',
  },
  logsQueryFooter: {
    details: 'data-testid logs-query-footer-details',
    footer: 'data-testid logs-query-footer',
  },
  patterns: {
    buttonExcludedPattern: 'data-testid button-excluded-pattern',
    buttonIncludedPattern: 'data-testid button-included-pattern',
    smallCell: 'data-testid patterns-small-cell',
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
    lineFilters: {
      addButton: 'data-testid line-filter-add',
      row: (keyLabel: string) => `data-testid line-filter-row-${keyLabel}`,
      operator: 'data-testid line-filter-operator',
      includeButton: 'data-testid line-filter-include',
      excludeButton: 'data-testid line-filter-exclude',
      regexToggle: 'data-testid line-filter-regex-toggle',
      caseSensitivityToggle: 'data-testid line-filter-case-sensitivity-toggle',
      clearButton: 'data-testid line-filter-clear',
      removeButton: 'data-testid line-filter-remove',
    },
    levels: {
      inputWrap: 'data-testid detected_level filter variable',
    },
    serviceName: {
      label: 'data-testid Dashboard template variables submenu Label Labels',
    },
  },
};
