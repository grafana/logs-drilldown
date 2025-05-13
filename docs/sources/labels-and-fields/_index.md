---
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/labels-and-fields/
description: Learn how breaking logs down by labels and fields can help you find the signal in the noise.
keywords:
  - Logs
  - Explore
  - Labels
  - Analysis
menuTitle: Labels and Fields
title: Labels and Fields
weight: 600
---

# Labels and Fields

Grafana Logs Drilldown visualises log volumes for the labels attached to your log lines, and fields automatically extracted from the text of the line itself.

{{< admonition type="note" >}}
The type of data being expressed in a label or field may require different treatments. For example, fields expressing `bytes` are visualized differently than other types of data. Please [share your feedback](https://forms.gle/1sYWCTPvD72T1dPH9) if you have suggestions for how to improve this experience.
{{< /admonition >}}

Grafana Logs Drilldown adds a special `detected_level` label to all log lines where Loki assigns a level of the log line, including `debug`, `info`, `warn`, `error`, `fatal`, `critical`, `trace`, or `unknown` if no level could be determined.

The `detected_labels` visualizations are helpful for:

- Spotting unexpected spikes in log volume.
- Noticing dips or outages in your services.
- Understanding the distribution of log lines across your labels.
- Identifying labels that might be useful for filtering or grouping your logs.

You can click the **Select** button on a Label or Field graph to access a breakdown of its values, seeing the log volumes visualized along the way.
This can be useful for understanding the traits of your system, and for spotting spikes or other changes.

## Labels tab user interface overview

Let's take a closer look at what you can do on the Labels tab.

The top navigation bar is common across the Grafana interface.
The next section is common across all the Logs Drilldown pages.

<!-- Make updating the screenshots easier by putting the Logs Drilldown version in the file name. This lets everyone know the last time the screenshots were updated.-->
{{< figure alt="Grafana Logs Drilldown Labels tab" caption="Labels tab" width="900px" align="center" src="/media/docs/explore-logs/labels_v1.0.14.png" >}}

Labels tab user interface:

- **Label** filter: Lets you search for or select label names from the menu.
- **Single / Grid / Rows**: Lets you select how the labels are displayed, in a grid or in rows.
- **Select** or **Include** button: Click to access a breakdown of the label's values, seeing the log volumes visualized along the way.
- **Menu** (three dots): Click to navigate to [Grafana Explore](https://grafana.com/docs/grafana-cloud/visualizations/explore/).

## Filtering logs by label

To explore labels with your own data, follow these steps:

1. From the Grafana main menu, select **Drilldown** > **Logs**.
1. Click the **Select** button for the **Service** you want to explore.
1. Click the **Labels** tab.
1. Browse the labels detected for this service.
1. Look for an interesting label and click the **Select** button.

You will see a selection of visualizations showing the volume of each label.

To remove the filter, select **All** from the **Label** search menu or click the **x** next to the selection in the Filter fields at the top of the page.

## Fields tab user interface overview

Let's take a closer look at what you can do on the Fields tab.

The top navigation bar is common across the Grafana interface.
The next section is common across all the Logs Drilldown pages.

<!-- Lets make updating the screenshots easier by putting the Logs Drilldown version in the file name. This lets you know the last time the screenshots were updated.-->
{{< figure alt="Grafana Logs Drilldown Fields tab" caption="Fields tab" width="900px" align="center" src="/media/docs/explore-logs/fields_v1.0.14.png" >}}

Fields tab user interface:

- **Field** filter: Lets you search for or select field names from the menu.
- **Single / Grid / Rows**: Lets you select how the fields are displayed, in a grid or in rows.
- **Add to filter** menu: Lets you add an expression to further filter the field values.-
- **Select** or **Include** button: Click to access a breakdown of the field's values, seeing the log volumes visualized along the way.
- **Menu** (three dots): Click to navigate to [Grafana Explore](https://grafana.com/docs/grafana-cloud/visualizations/explore/).

## Filtering logs by field

To explore fields with your own data, follow these steps:

1. From the Grafana main menu, select **Drilldown** > **Logs**.
1. Click the **Select** button for the **Service** you want to explore.
1. Click the **Fields** tab.
1. Browse the fields detected for this service.
1. Look for an interesting field and click the **Select** button.

You will see a selection of visualizations showing the volume of each field.

To remove the filter, select **All** from the **Filter** search menu or click the **x** next to the selection in the Filter fields at the top of the page.

## What next?

Learn about how [Log patterns](https://grafana.com/docs/grafana-cloud/visualizations/simplified-exploration/logs/patterns/) can help you deal with different types of log lines in bulk.
