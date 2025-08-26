import { reportInteraction } from '@grafana/runtime';

import pluginJson from '../plugin.json';

// Helper function to create a unique interaction name for analytics
const createInteractionName = (page: UserEventPagesType, action: string) => {
  return `${pluginJson.id.replace(/-/g, '_')}_${page}_${action}`;
};

// Runs reportInteraction with a standardized interaction name
export const reportAppInteraction = (
  page: UserEventPagesType,
  action: UserEventActionType,
  properties?: Record<string, unknown>,
  once = false
) => {
  const interactionName = createInteractionName(page, action);
  if (once) {
    if (sessionStorage.getItem(interactionName)) {
      return;
    }
    sessionStorage.setItem(interactionName, '1');
  }
  reportInteraction(interactionName, properties);
};

export const USER_EVENTS_PAGES = {
  all: 'all',
  service_details: 'service_details',
  service_selection: 'service_selection',
} as const;

type UserEventPagesType = keyof typeof USER_EVENTS_PAGES;
type UserEventActionType =
  | keyof (typeof USER_EVENTS_ACTIONS)['service_selection']
  | keyof (typeof USER_EVENTS_ACTIONS)['service_details']
  | keyof (typeof USER_EVENTS_ACTIONS)['all'];

export const USER_EVENTS_ACTIONS = {
  [USER_EVENTS_PAGES.service_selection]: {
    add_to_filters: 'add_to_filters',
    // Toggling aggregated metrics on/off
    aggregated_metrics_toggled: 'aggregated_metrics_toggled',
    // Searching for service using search input. Props: searchQueryLength, containsLevel
    search_services_changed: 'search_services_changed',
    // Selecting service. Props: service
    service_selected: 'service_selected',
  },
  [USER_EVENTS_PAGES.service_details]: {
    // Selecting action view tab (logs/labels/fields/patterns). Props: newActionView, previousActionView
    action_view_changed: 'action_view_changed',
    // Clicking on "Include" button in time series panels. Used in multiple views. The view type is passed as a parameter. Props: filterType, key, isFilterDuplicate, filtersLength
    add_to_filters_in_breakdown_clicked: 'add_to_filters_in_breakdown_clicked',
    // Adding a positive or negative filter from the JSON panel
    add_to_filters_in_json_panel: 'add_to_filters_in_json_panel',
    // Setting a new root in the json panel
    change_line_format_in_json_panel: 'change_line_format_in_json_panel',
    change_viz_type: 'change_viz_type',
    label_in_panel_summary_clicked: 'label_in_panel_summary_clicked',
    // Changing layout type (e.g. single/grid/rows). Used in multiple views. The view type is passed as a parameter. Props: layout, view
    layout_type_changed: 'layout_type_changed',
    // Clicking on one of the levels in the Logs Volume panel
    level_in_logs_volume_clicked: 'level_in_logs_volume_clicked',
    // Clear all displayed fields
    logs_clear_displayed_fields: 'logs_clear_displayed_fields',
    // Fires when logs panel query returns successfully
    logs_on_query_complete: 'logs_on_query_complete',
    // Fires when logs panel query returns an error
    logs_on_query_error: 'logs_on_query_error',
    // Filter (include, exclude) from log details
    logs_detail_filter_applied: 'logs_detail_filter_applied',
    // Popover menu filter
    logs_popover_line_filter: 'logs_popover_line_filter',
    // Toggle displayed fields
    logs_toggle_displayed_field: 'logs_toggle_displayed_field',
    // Toggling between logs/table/json view
    logs_visualization_toggle: 'logs_visualization_toggle',
    open_in_explore_clicked: 'open_in_explore_clicked',
    // Clicking on a pattern field in the pattern name.
    pattern_field_clicked: 'pattern_field_clicked',
    // Removing a pattern (e.g. include/exclude) from the list. Props: includePatternsLength, excludePatternsLength, type
    pattern_removed: 'pattern_removed',
    // Selecting a pattern (e.g. include/exclude) from the list. Props: includePatternsLength, excludePatternsLength, type
    pattern_selected: 'pattern_selected',
    // Changing search string in logs. Props: searchQuery
    search_string_in_logs_changed: 'search_string_in_logs_changed',
    search_string_in_variables_changed: 'search_string_in_variables_changed',
    // Clicking on "Select" button button in time series panels. Used in multiple views.The view type is passed as a parameter. Props: field, previousField, view
    select_field_in_breakdown_clicked: 'select_field_in_breakdown_clicked',
    toggle_error_panels: 'toggle_error_panels',
    // Value breakdown sort change
    value_breakdown_sort_change: 'value_breakdown_sort_change',
    // Wasm not supported
    wasm_not_supported: 'wasm_not_supported',
    // Go to explore button in embedded UI
    embedded_go_to_explore_clicked: 'embedded_go_to_explore_clicked',
    // Fires when viz is activated
    visualization_init: 'visualization_init',
    // fields rollup viz type toggle
    fields_panel_type_toggle: 'fields_panel_type_toggle',
    // table header buttons
    table_columns_header_button_reset_width: 'table_columns_header_button_reset_width',
    table_columns_header_button_show_labels: 'table_columns_header_button_show_labels',
    table_columns_header_button_show_text: 'table_columns_header_button_show_text',
    // table column header menu
    table_columns_header_menu_show: 'table_columns_header_menu_show',
    table_columns_header_menu_reset_width: 'table_columns_header_menu_reset_width',
    table_columns_header_menu_show_labels: 'table_columns_header_menu_show_labels',
    table_columns_header_menu_show_text: 'table_columns_header_menu_show_text',
    table_columns_header_menu_slide_left: 'table_columns_header_menu_slide_left',
    table_columns_header_menu_slide_right: 'table_columns_header_menu_slide_right',
    table_columns_header_menu_hide_column: 'table_columns_header_menu_hide_column',
    // Embedded
    embedded_init: 'embedded_init',
    embedded_error: 'embedded_error',
    // link button on click
    link_button_click: 'link_button_click',
  },
  [USER_EVENTS_PAGES.all]: {
    interval_too_long: 'interval_too_long',
    open_in_explore_menu_clicked: 'open_in_explore_menu_clicked',
  },
} as const;
