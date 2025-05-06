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
If you have a Grafana Cloud account, you can access Grafana Logs Drilldown by selecting **Drilldown** > **Logs**, or you can [install Grafana Logs Drilldown](https://grafana.com/docs/grafana-cloud/visualizations/simplified-exploration/logs/access/) in your own Grafana instance.

<!-- Comment - NEEDS TO BE REPLACED WITH UPDATED VIDEO
To learn more, check out our overview video:

{{< youtube id="iH0Ufv2bD1U" >}}-->

## Guided tour

We will walk through a simple step-by-step guided tour of Grafana Logs Drilldown.

While you are browsing your log data in Grafana Logs Drilldown, watch for any unexpected spikes in your logs. Or perhaps one of your services is down and has stopped logging. Maybe you're seeing an increase in errors after a recent release.

<!-- Make updating the screenshots easier by putting the Logs Drilldown version in the file name. This lets everyone know the last time the screenshots were updated.-->

{{< figure alt="Grafana Logs Drilldown Service overview page" width="900px" align="center" src="/media/docs/explore-logs/landing_page_index_V1.0.14.png" caption="Overview page" >}}

To take a tour of Grafana Logs Drilldown, follow these steps:

1. Open your Grafana stack in a web browser.
1. From the Grafana main menu, select **Drilldown** > **Logs**.
   This opens the **Overview page** showing time series and log visualizations for all the services in your selected Loki instance. ([No services?](https://grafana.com/docs/grafana-cloud/visualizations/simplified-exploration/logs/troubleshooting/#there-are-no-services))
1. If you have multiple Loki data sources, you can change your **Data source** from the menu on the top left. Note that Logs Drilldown only supports Loki data sources.
1. Select a recent time range. You can modify your time range in two ways:
   - With the standard time range picker on the top right.
   - By clicking and dragging the time range on any time series visualization.
1. Services are shown based on the volume of logs, or you can use the **Search Services** field to search for the service by name.
1. If you want to view services by label instead of by service name, click **(+) Add label** and either select a label from the menu or search for a label.
1. To explore logs for a service, click the **Show logs** button on the service graph. Grafana displays the **Logs** tab of the service details page.
1. On the service details page, click the **Labels** tab to see visualizations of the log volume for each label. ([No labels?](../troubleshooting/#there-are-no-labels))
1. On the **Labels** tab, to select a label to see the log volume for each value of that label, click the **Select** button.
   Grafana Logs Drilldown shows you the volume of logs with specific labels and fields. Learn more about [Labels and Fields](../labels-and-fields/).
1. Select the **Fields** tab to see visualizations of the log volume for each field. To drill down into the details in the same way as labels, click the **Select** button for one of the fields.
1. Click the **Patterns** tab to see the log volume for each automatically detected pattern.
   Log patterns let you work with groups of similar log lines. You can hide log patterns that are noisy, or focus only on the patterns that are most useful. Learn more about [Log Patterns](../patterns/).
