---
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/viewing-json-logs/
description: Learn how to view JSON formatted logs in Logs Drilldown.
keywords:
  - Logs
  - JSON
  - Formatting
  - Drain
  - Categorization
  - Analysis
menuTitle: Viewing JSON logs
title: Viewing JSON logs
weight: 400
---

# Viewing JSON Logs

If your log lines are formatted in the JSON format, you can view them more easily using Grafana's JSON viewer in the Logs table.


{{< admonition type="note" >}}
You must be running Loki 3.5.0 or later to use the JSON viewer
{{< /admonition >}}

To interact with the JSON view, select the **Show Logs** button for your service in Logs Drilldown. 

{{< figure alt="JSON Table viewer with selector and include exclude highlighted" width="900px" align="center" src="/media/docs/explore-logs/show-logs.png" caption="The JSON log line viewer" >}}

From there, select **JSON** in the format menu in the top right toolbar. This will show your logs in a structured, collapsable way, enabling you to sort, filter, and otherwise adjust your log data in the visualisations for your logs.

{{< figure alt="Show Logs button on a JSON logging service" width="300px" align="center" src="/media/docs/explore-logs/json-viewer.png" caption="Show Logs button on a service which logs JSON" >}}

## Filtering log lines with the JSON view

Users can include and exclude specific log data from their visualizations by selecting the **Include/Exclude** icons next to a given label. 

For example, given a set of logs of API requests, selecting the **exclude** button next to a method field with status "GET" will result in the Log Volume dashboard showing only requests of other types (DELETE/PATCH/POST/PUT).

To include them again, simply remove them from the **Fields** filter above the Logs Volume visualization. 

{{< admonition type="note" >}}
We are keen to improve this feature, so please [contact us](https://forms.gle/1sYWCTPvD72T1dPH9) if there is something that would help you find the signal in the noise.
{{< /admonition >}}
