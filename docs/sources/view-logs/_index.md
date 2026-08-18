---
title: View logs
description: Learn about the logs visualization and controls in Grafana Logs Drilldown.
weight: 500
---

# View logs

The logs visualization in Grafana Logs Drilldown displays log lines from your Loki data source, with filtering options and controls to customize the display.

A line filter search field appears at the top of the page. Enter text to filter your logs to lines that contain, or exclude, that text.

## Visualization types

On the **Logs** tab, use the radio buttons in the panel header to switch how Logs Drilldown displays your logs:

- **Logs**: The default log line list, with the [log controls](#log-controls), the [log line menu](#log-line-menu), and [log details](#log-details), described on this page.
- **Table**: Displays logs in a table with a column for each displayed field. You can add or remove columns, sort by a column, resize columns, and wrap text. For more information, refer to [Logs Drilldown table view](./table/).
- **JSON**: Opens the dedicated JSON viewer for logs formatted as JSON. For more information, refer to [Logs Drilldown JSON viewer](./json/).

## Log controls

The controls component provides options to interact with and customize the log list. You can jump to the top or bottom, change sort order, filter by string or level, use deduplication, and choose display options such as timestamp format or color highlighting.

From top to bottom, the log controls include:

- **Expand/collapse controls**: Show or hide the full controls toolbar.
- **Scroll to the bottom**: Jump to the last log line in the view.
- **Sort direction**: Toggle between ascending (oldest logs first) or descending (newest logs first) order.
- **Client-side string search**: Click to open or close client-side string search for displayed results.
- **Deduplication**: Hide duplicate log lines using a few different deduplication algorithms.
  - **None**: Disables deduplication.
  - **Exact**: Matches on the whole line except for date fields.
  - **Numbers**: Matches after stripping out numbers such as durations, IP addresses, and so on.
  - **Signature**: The most aggressive deduplication as it strips all letters and numbers and matches on the remaining whitespace and punctuation.
- **Filter logs by log level**: Filter logs by level, such as All levels, Info, Warn, and Error.
- **Set timestamp format**: Hide timestamps, show millisecond timestamps, or show nanosecond timestamps.
- **Line wrapping control**:
  - **Disabled**: Log lines are truncated.
  - **Enabled**: Log lines wrap to multiple lines.
  - **Enabled with JSON formatting**: Pretty-prints JSON log lines.
- **Logs highlighting**: Toggle between plain text and color highlighting.
- **Font size control**: Toggle between small (default) and large font.
- **Unescape newlines**: Displayed when logs contain escaped new lines. Click to render escaped new lines as new lines.
- **Download logs**: Download in plain text (`txt`), JavaScript Object Notation (JSON), or Comma-separated values (CSV) format.
- **Scroll to the top**: Jump to the first log line in the view.

{{< admonition type="note" >}}
When you're in [JSON view](./json/), these controls aren't available: client-side string search, deduplication, filter by log level, timestamp format, font size control, and download logs. JSON view includes additional toggles for showing structured metadata and labels.
{{< /admonition >}}

## Panel menu

Most panels in Logs Drilldown have a menu that you open by clicking the menu icon (three vertical dots) in the panel header. The available options depend on the panel and your Grafana configuration:

- **Explore**: Opens Grafana Explore with a query based on your current selections.
- **Add to Dashboard**: Adds the panel to a new or existing dashboard.
- **Create alert**: Creates an alert rule from the panel's query.
- **Expand logs view** or **Condense logs view**: On the logs panel, toggles the logs list between fitting the available height and expanding to fill the screen.
- **Explain in Assistant**: Sends the panel's query to Grafana Assistant for an explanation.

Some options, such as **Add to Dashboard**, **Create alert**, and **Explain in Assistant**, appear only when the corresponding Grafana feature is available.

## Log line menu

Click the menu icon (three vertical dots) at the start of a log line to open the log line menu.

{{< figure alt="A log line menu open over the log list, showing the Show log details, Show context, and Pin log options, followed by copy options and Explain log line in Assistant" width="900px" align="center" src="/media/docs/explore-logs/v2/logs-drilldown-logs-ellipsis-menu.png" caption="The log line menu" >}}

The menu includes the following options:

- **Show log details**: Opens [log details](#log-details) for the log line. When details are already open, the option reads **Hide log details**.
- **Show context**: Displays the log lines that arrived before and after the selected line. Refer to [Log context](#log-context) for more information.
- **Pin log**: Keeps the log line pinned in the log list. To remove the pin, select **Unpin log**.
- **Copy log line message**: Copies the log line text to your clipboard.
- **Copy log line contents as JSON**: Copies the log line, including its fields, as a JSON object.
- **Copy link to log line**: Copies a short link that opens Logs Drilldown focused on this log line, so you can share it.
- **Explain log line in Assistant**: Sends the log line to Grafana Assistant for an explanation. This option only appears when Grafana Assistant is available.

## Log details

Log details show all the information attached to a single log line.

To open log details, click a log line or select **Show log details** from the log line menu.

{{< figure alt="The log details sidebar next to the log list, with the copy menu open and collapsible sections for the log line, links to tracing data sources, a trace, and indexed labels" width="900px" align="center" src="/media/docs/explore-logs/v2/logs-drilldown-logs-details-copy-menu.png" caption="Log details in sidebar mode" >}}

At the top of log details, use the **Search field names and values** field to narrow down what's displayed. The copy icon opens a menu with **Copy log line message** and **Copy log contents as JSON** options.

Log details organize the information in collapsible sections:

- **Log line**: The raw log line.
- **Links**: Data links and correlations, which turn parts of the log line into links to related data or external resources, for example a trace ID linking to your tracing data source.
- **Trace**: A preview of the trace, when the log line contains a trace link.
- Fields, grouped by type for data sources that support it. For Loki, the groups are **Indexed labels**, **Structured metadata**, and **Parsed fields**.

### Work with fields

Each field row has icons to act on that field:

- **Filter for value** and **Filter out value**: Add the field to your query as an equality or inequality expression. When a filter is already active, you can toggle it off or flip it from positive to negative.
- The eye icon: Shows the field in the log list instead of the complete log line, or hides it again.
- **Ad-hoc statistics**: Displays how the field's values are distributed across the displayed logs.
- The copy icon: Copies the field's value to your clipboard.

### Log details modes

There are two modes to view log details:

- **Inline** displays the log details below the log line within the log list.
- **Sidebar** displays the log details in a panel to the side of the log list.

To switch modes, use the mode icon in the log details header: **Anchor to the right** switches to the sidebar, and **Display inline** moves the details back into the list.

## Highlighting

The logs visualization implements a predefined set of rules to apply subtle colors to the log lines, to help with readability and help with identifying important information faster. You can disable this optional feature in the controls or in the panel options.

Log levels are also color-coded to help you scan for errors and warnings. For example, `debug` lines use a neutral gray and `info` lines use a neutral blue.

## Log Context

Log context is a feature that displays additional lines of context surrounding a log entry that matches a specific search query. This helps in understanding the context of the log entry and is similar to the `-C` parameter in the grep command.

If you're using Loki for your logs, to modify your log context queries, use the Loki log context query editor at the top. You can activate this editor by clicking on the log context query preview. Within it, you have the option to modify your search by removing one or more label filters from the log stream. If your original query used a parser, you can refine your search by leveraging extracted label filters.

Change the **Context time window** option to look for logs within a specific time interval around your log line.

## Infinite scroll

When you reach the bottom of the list of logs, if you continue scrolling and the displayed logs are within the selected time interval, you can request to load more logs. When the sort order is "newest first" you receive older logs, and when the sort order is "oldest first" you get newer logs.
