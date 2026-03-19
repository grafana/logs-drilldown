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

To interact with the JSON view, select **Show logs** for your service in Logs Drilldown.

{{< figure alt="Logs Drilldown service panel with Show logs highlighted" caption="Show logs button" width="500px" align="center" src="/media/docs/explore-logs/v2/logs-drilldown-show-logs.png" >}}

On the **Logs** tab, select the **JSON** radio button in the panel header (next to **Logs** and **Table**) to switch to the JSON viewer. Your logs are displayed in a structured, collapsible tree view, enabling you to browse, expand, and collapse JSON fields.

{{< figure alt="Logs Drilldown JSON viewer with structured log rows" width="900px" align="center" src="/media/docs/explore-logs/v2/logs-drilldown-json-viewer.png" caption="The JSON viewer" >}}

The **Line wrapping** control in the log controls panel also offers an **Enabled with JSON formatting** option. This pretty-prints JSON within the standard Logs view but does not open the dedicated JSON viewer. For more information about line wrapping, refer to [View logs](../view-logs/).

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
