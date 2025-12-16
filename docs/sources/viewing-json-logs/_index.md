---
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/viewing-json-logs/
description: Learn how to view JSON formatted logs in Logs Drilldown.
keywords:
  - Logs
  - JSON
  - Formatting
menuTitle: Viewing JSON logs
title: Logs Drilldown JSON viewer
weight: 800
---

# Logs Drilldown JSON viewer

You can easily view and interact with your JSON formatted logs using the Logs Drilldown JSON viewer. This view will help you read your JSON style logs, and filter through them to make your related visualizations more relevant and focused.

{{< admonition type="note" >}}
To use this feature, you must be running Loki 3.5.0 or later.
{{< /admonition >}}

## Viewing JSON logs

To interact with the JSON view, select the **Show Logs** button for your service in Logs Drilldown.

{{< figure alt="JSON Table viewer with selector and include exclude highlighted" caption="Show Logs button" width="500px" align="center" src="/media/docs/explore-logs/show-logs.png" >}}

You can use the **Line wrapping** control in the log controls to enable JSON formatting. When enabled with JSON formatting, your logs will be displayed in a structured, collapsible way, enabling you to sort, filter, and otherwise adjust your log data in the visualizations for your logs.

The line wrapping control offers three options:
- **Disabled**: Log lines are truncated at the edge of the panel.
- **Enabled**: Log lines wrap to multiple lines.
- **Enabled with JSON formatting**: JSON logs are pretty-printed for easier reading.

{{< figure alt="Show Logs button on a JSON logging service" width="900px" align="center" src="/media/docs/explore-logs/json-viewer.png" caption="The JSON viewer" >}}

For more information about log controls, refer to [View logs](../view-logs/).

## Filtering log lines with the JSON view

You can include and exclude specific log data from your visualizations by clicking on individual log lines to open the **Log Details** panel. Within Log Details, you can:

- Click the **Include/Exclude** (plus/minus) icons next to fields to add them to your filter.
- Click the eye icon to select specific fields to display in the logs list.
- View field statistics by clicking the stats icon.

For example: Given a set of logs from an API request service, you can click on a log line, then select the **Exclude** button next to the `method` field with value "GET". This will result in the Log Volume visualization showing only requests of other method types (DELETE/PATCH/POST/PUT).

To include filtered log data again, remove the excluded data from the **Fields** filter above the Log Volume visualization.

## Supported JSON log types

Log lines entirely formatted as JSON are supported.

Log lines with only certain fields or metadata structured as JSON are not currently supported.

{{< admonition type="note" >}}
We are keen to improve this feature, so please [contact us](https://forms.gle/1sYWCTPvD72T1dPH9) if there is something that would help you find the signal in the noise.
{{< /admonition >}}
