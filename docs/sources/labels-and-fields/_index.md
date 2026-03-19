---
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/labels-and-fields/
description: Learn how breaking logs down by labels and fields can help you find the signal in the noise.
keywords:
  - Logs
  - Explore
  - Labels
  - Analysis
menuTitle: Labels and fields
title: Labels and fields
weight: 600
---

# Labels and fields

Grafana Logs Drilldown visualizes log volume for labels attached to your log lines, and for fields automatically extracted from each log line.

{{< admonition type="note" >}}
The type of data being expressed in a label or field may require different treatments. For example, fields expressing `bytes` are visualized differently than other types of data. [Share your feedback](https://forms.gle/1sYWCTPvD72T1dPH9) if you have suggestions for how to improve this experience.
{{< /admonition >}}

Grafana Logs Drilldown adds a special `detected_level` label to all log lines where Loki assigns a level of the log line, including `debug`, `info`, `warn`, `error`, `fatal`, `critical`, `trace`, or `unknown` if no level could be determined.

Label visualizations are helpful for:

- Spotting unexpected spikes in log volume.
- Noticing dips or outages in your services.
- Understanding the distribution of log lines across your labels.
- Identifying labels that might be useful for filtering or grouping your logs.

You can click the **Select** button on a Label or Field graph to access a breakdown of its values, seeing the log volumes visualized along the way.
This can be useful for understanding the traits of your system, and for spotting spikes or other changes.

Click individual log lines to view the **Log Details** panel which displays fields and labels with filtering options. For more information about Log Details, refer to [View logs](../view-logs/).

## Labels tab user interface overview

Let's take a closer look at what you can do on the Labels tab.

The top navigation bar is common across the Grafana interface.
The next section is common across all the Logs Drilldown pages.

<!-- Make updating the screenshots easier by putting the Logs Drilldown version in the file name. This lets everyone know the last time the screenshots were updated.-->

{{< figure alt="Grafana Logs Drilldown Labels tab" caption="Labels tab" width="900px" align="center" src="/media/docs/explore-logs/v2/logs-drilldown-labels.png" >}}

Labels tab user interface:

- **Label** filter: Lets you search for or select label names from the menu.
- **Grid / Rows**: Lets you select how labels are displayed.
- **Select** or **Include** button: Click to access a breakdown of the label's values, seeing the log volumes visualized along the way.
- **Menu** (three dots): Click to navigate to [Grafana Explore](https://grafana.com/docs/grafana-cloud/visualizations/explore/).

## Filtering logs by label

To explore labels with your own data, follow these steps:

1. From the Grafana main menu, select **Drilldown** > **Logs**.
1. Click **Show logs** for the service you want to explore.
1. Click the **Labels** tab on the service details page.
1. Browse the labels detected for this service.
1. Look for an interesting label and click the **Select** button.

You will see a selection of visualizations showing the volume of each label.

To remove the filter, select **All** from the **Label** search menu or click the **x** next to the selection in the Filter fields at the top of the page.

## Fields tab user interface overview

Let's take a closer look at what you can do on the Fields tab.

The top navigation bar is common across the Grafana interface.
The next section is common across all the Logs Drilldown pages.

<!-- Lets make updating the screenshots easier by putting the Logs Drilldown version in the file name. This lets you know the last time the screenshots were updated.-->

{{< figure alt="Grafana Logs Drilldown Fields tab" caption="Fields tab" width="900px" align="center" src="/media/docs/explore-logs/v2/logs-drilldown-fields.png" >}}

Fields tab user interface:

- **Field** filter: Lets you search for or select field names from the menu.
- **Grid / Rows**: Lets you select how fields are displayed.
- **Volume / Names**: Lets you toggle between showing field volume graphs and showing field names only.
- **Include** or **Add to filter** button: Lets you filter log results by a specific field value. The button label varies depending on the field type.
- **Select** button (value breakdown): Click to access a breakdown of the field's values, seeing the log volumes visualized along the way.
- **Menu** (three dots): Click to navigate to [Grafana Explore](https://grafana.com/docs/grafana-cloud/visualizations/explore/).

## Filtering logs by field

To explore fields with your own data, follow these steps:

1. From the Grafana main menu, select **Drilldown** > **Logs**.
1. Click **Show logs** for the service you want to explore.
1. Click the **Fields** tab on the service details page.
1. Browse the fields detected for this service.
1. Look for an interesting field and click the **Select** button.

To remove the filter, select **All** from the **Field** search menu or click the **x** next to the selection in the Filter fields at the top of the page.

## What next?

Learn how [Log patterns](../patterns/) can help you work with different types of log lines in bulk.
