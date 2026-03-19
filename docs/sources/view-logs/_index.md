---
title: View logs
description: Learn about the logs visualization and controls in Grafana Logs Drilldown.
weight: 500
---

# View logs

The logs visualization in Grafana Logs Drilldown displays log lines from your Loki data source with filtering options and controls to customize how data is displayed.

## Log controls

The controls component provides options to interact with and customize the log list. You can jump to the top or bottom, change sort order, filter by string or level, use deduplication, and choose display options such as timestamp format or color highlighting.

From top to bottom, the log controls include:

* **Expand/collapse controls**: Show or hide the full controls toolbar.
* **Scroll to the bottom**: Jump to the last log line in the view.
* **Sort direction**: Toggle between ascending (oldest logs first) or descending (newest logs first) order.
* **Client-side string search**: Click to open or close client-side string search for displayed results.
* **Deduplication**: Hide duplicate log lines using a few different deduplication algorithms.
  * **None**: Disables deduplication.
  * **Exact**: Matches on the whole line except for date fields.
  * **Numbers**: Matches after stripping out numbers such as durations, IP addresses, and so on.
  * **Signature**: The most aggressive deduplication as it strips all letters and numbers and matches on the remaining whitespace and punctuation.
* **Filter logs by log level**: Filter logs by level, such as All levels, Info, Warn, and Error.
* **Set timestamp format**: Hide timestamps, show millisecond timestamps, or show nanosecond timestamps.
* **Line wrapping control**:
  * **Disabled**: Log lines are truncated.
  * **Enabled**: Log lines wrap to multiple lines.
  * **Enabled with JSON formatting**: Pretty-prints JSON log lines.
* **Logs highlighting**: Toggle between plain text and color highlighting.
* **Font size control**: Toggle between small (default) and large font.
* **Unescape newlines**: Displayed when logs contain escaped new lines. Click to render escaped new lines as new lines.
* **Download logs**: Download in plain text (txt), JavaScript Object Notation (JSON), or Comma-separated values (CSV) format.
* **Scroll to the top**: Jump to the first log line in the view.

{{< admonition type="note" >}}
When you are in [JSON view](../viewing-json-logs/), these controls are not available: client-side string search, deduplication, filter by log level, timestamp format, font size control, and download logs. JSON view includes additional toggles for showing structured metadata and labels.
{{< /admonition >}}

## Log Details

The **Log details** component is displayed when you click a log line. It shows additional information from that log line in collapsible sections, including fields (usually key-value pairs) and links (derived fields, correlations, and more).

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
