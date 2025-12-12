---
title: View logs
description: Learn about the logs visualization and controls in Grafana Logs Drilldown.
weight: 500
---

# View logs

The logs visualization in Grafana Logs Drilldown displays log lines from your Loki data source with filtering options and controls to customize how data is displayed.

## Log controls

The controls component provides different options to interact with and customize the list of logs. You can find options to jump to the top or bottom of the list, change the sort order, filter by string or level, access deduplication, and select display options such as the timestamp format or color highlighting.

From top to bottom, the log controls include:

* **Expand/collapse controls**: Show or hide the full controls toolbar.
* **Scroll to the bottom**: Jump to the last log line in the view.
* **Sort direction**: Toggle between ascending (oldest logs first) or descending (newest logs first) order.
* **Client-side string search**: Click to open/close the client side string search of the displayed logs result.
* **Deduplication**: Hide duplicate log lines using a few different deduplication algorithms.
  * **None**: Disables deduplication.
  * **Exact**: Matches on the whole line except for date fields.
  * **Numbers**: Matches after stripping out numbers such as durations, IP addresses, and so on.
  * **Signature**: The most aggressive deduplication as it strips all letters and numbers and matches on the remaining whitespace and punctuation.
* **Filter logs by log level**: Filters logs by log level: All levels, Info, Debut, Warning, Error
* **Set timestamp format**: Hide timestamps (disabled), Show milliseconds timestamps, Show nanoseconds timestamps.
* **Line wrapping control**:
  * **Disabled**: Log lines are truncated.
  * **Enabled**: Log lines wrap to multiple lines.
  * **Enabled with JSON formatting**: Pretty-prints JSON log lines.
* **Logs highlighting**: Plain text or color highlighting enabled.
* **Font size control**: Small font (default), Large font..
* **Unescape newlines**: Conditionally displayed if the logs contain escaped new lines. Click to unescape and display as new lines.
* **Download logs**: Download in plain text (txt), JavaScript Object Notation (JSON), or Comma-separated values (CSV) format.

{{< admonition type="note" >}}
Note that when in [JSON view](../viewing-json-logs/) the following controls are not available: Client-side string search, Deduplication, Filter logs by log level, Set timestamp format,  Font size control, and Download logs.  JSON view does include two additional controls: Show/Hide metadata and Show/Hide labels.
{{< /admonition >}}

## Log Details

The Log Details component is displayed by clicking on a log line. It displays more information that is part of the log line in collapsible sections containing details such as fields (usually key-value pairs) and links (derived fields, correlations, etc.).

### Fields

Within the Log details view, you have the ability to filter the displayed fields in two ways:

* **Positive filter**: Focuses on a specific field
* **Negative filter**: Excludes certain fields

These filters modify the corresponding query that generated the log line, incorporating equality and inequality expressions accordingly.

For supported data sources like Loki and Elasticsearch, log details will verify whether the field is already included in the current query, indicating an active state for positive filters. This enables you to toggle it off from the query or convert the filter expression from positive to negative as necessary.

Click the eye icon to select a subset of fields to visualize in the logs list instead of the complete log line.

Each field has a stats icon, which displays ad-hoc statistics in relation to all displayed logs.

For data sources that support log types, such as Loki, instead of a single view containing all fields, different groups of fields will be displayed grouping them by their type: Indexed Labels, Structured Metadata, and Parsed fields.

### Links

Grafana provides data links or correlations, allowing you to convert any part of a log message into an internal or external link. These links enable you to navigate to related data or external resources, offering a seamless and convenient way to explore additional information.

### Log details modes

There are two modes available to view log details: 

- **Inline log details** display the log details below the log line within the log list.

- **Sidebar log details** display the log details in a panel to the side of the log list.

No matter which display mode you are currently viewing, you can change it by clicking the mode control icon.

## Highlighting

The logs visualization implements a predefined set of rules to apply subtle colors to the log lines, to help with readability and help with identifying important information faster. This is an optional feature that can be disabled in the controls or in the panel options.

## Log Context

Log context is a feature that displays additional lines of context surrounding a log entry that matches a specific search query. This helps in understanding the context of the log entry and is similar to the `-C` parameter in the grep command.

If you're using Loki for your logs, to modify your log context queries, use the Loki log context query editor at the top. You can activate this editor by clicking on the log context query preview. Within it, you have the option to modify your search by removing one or more label filters from the log stream. If your original query used a parser, you can refine your search by leveraging extracted label filters.

Change the **Context time window** option to look for logs within a specific time interval around your log line.

## Infinite scroll

When you reach the bottom of the list of logs, if you continue scrolling and the displayed logs are within the selected time interval, you can request to load more logs. When the sort order is "newest first" you will receive older logs, and when the sort order is "oldest first" you will get newer logs.
