---
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/get-started/
description: Provides a guided tour of the features in Grafana Logs Drilldown.
keywords:
  - Logs
  - Explore
  - Labels
  - Analysis
menuTitle: Get started
title: Get started with Grafana Logs Drilldown
weight: 300
---

# Get started with Grafana Logs Drilldown

The best way to see what Grafana Logs Drilldown can do for you is to use it to explore your own log data.
If you have a Grafana Cloud account, you can access Grafana Logs Drilldown by selecting **Drilldown** > **Logs**, or you can [install Grafana Logs Drilldown](../access/) in your own Grafana instance.

<!-- Comment - NEEDS TO BE REPLACED WITH UPDATED VIDEO
To learn more, check out our overview video:

{{< youtube id="iH0Ufv2bD1U" >}}-->

## Guided tour

While you are browsing your log data in Grafana Logs Drilldown, watch for any unexpected spikes in your logs. Or perhaps one of your services is down and has stopped logging. Maybe you're seeing an increase in errors after a recent release.

<!-- Make updating the screenshots easier by putting the Logs Drilldown version in the file name. This lets everyone know the last time the screenshots were updated.-->

{{< figure alt="Grafana Logs Drilldown Service overview page" width="900px" align="center" src="/media/docs/explore-logs/v2/logs-drilldown-overview.png" caption="Overview page" >}}

To take a tour of Grafana Logs Drilldown, follow these steps:

1. Open your Grafana stack in a web browser.
1. From the Grafana main menu, select **Drilldown** > **Logs**.
   This opens the **Overview page** showing time series and log visualizations for all services in your selected Loki instance. ([No services?](../troubleshooting/#there-are-no-services))
1. If you have multiple Loki data sources, you can change your **Data source** from the menu in the top toolbar. Logs Drilldown only supports Loki data sources.
1. Select a recent time range. You can modify your time range in two ways:
   - With the standard time range picker on the top right.
   - By clicking and dragging the time range on any time series visualization.
1. Services are shown based on log volume. You can use the service search field to find a service by name.
1. If you want to view services by label instead of by service name, click **(+) Add label** and either select a label from the menu or search for a label.

   {{< admonition type="tip" >}}
   Administrators can configure default fields to display in log visualizations. Refer to [Configure Logs Drilldown](../access/configure/) for details.
   {{< /admonition >}}

   <!-- Uncomment when Grafana 13.0 is released:
   {{< admonition type="tip" >}}
   Administrators can configure which labels appear by default on the landing page. Refer to [Configure Logs Drilldown](../access/configure/) for details.
   {{< /admonition >}}
   -->

1. To explore logs for a service, click **Show logs** on the service panel. Grafana opens the service details page on the **Logs** tab.
1. On the Logs tab, you can:
   - Use the log controls (which can be expanded using the expand/collapse button on the right) to adjust sort order, filter by string or level, change display options, and more. For details, refer to [View logs](../view-logs/).
   - Click individual log lines to view detailed information including fields and links in the Log Details panel.
   - Scroll to the bottom to load more log entries with infinite scroll.
   - Use line wrapping controls to adapt the log display for easier reading, choosing between disabled, enabled, and enabled with JSON formatting.
1. On the service details page, click the **Labels** tab to see visualizations of log volume for each label. ([No labels?](../troubleshooting/#there-are-no-labels))
1. On the **Labels** tab, to select a label to see the log volume for each value of that label, click the **Select** button.
   Grafana Logs Drilldown shows you the volume of logs with specific labels and fields. Refer to [Labels and Fields](../labels-and-fields/).
1. Select the **Fields** tab to see visualizations of log volume for each field. To drill down into details the same way as labels, click **Select** for a field.
1. Click the **Patterns** tab to see log volume for each automatically detected pattern.
   Log patterns let you work with groups of similar log lines. You can hide log patterns that are noisy, or focus only on the patterns that are most useful. Refer to [Log Patterns](../patterns/).
1. Click the **Logs** tab. Click **Explore** in the panel header. Grafana displays the Explore page, with a query based on the selections you made in Logs Drilldown.

## Further resources

- Watch: [How to Use the Logs Drilldown App for Grafana](https://www.youtube.com/watch?v=eXwE2vqLcyY)
- Watch: [All About Logs Drilldown for Grafana Loki](https://www.youtube.com/live/XJMQbEuBeMc) (Loki Community Call October 2024)
