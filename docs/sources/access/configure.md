---
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/access/configure/
description: Describes the plugin configuration settings for Grafana Logs Drilldown, including the Configuration tab, Landing Page default labels, and Default fields.
keywords:
  - Logs
  - Explore
  - Labels
  - Analysis
  - Configuration
  - Admin
  - Default labels
  - Landing page
  - Default fields
  - Default time range
menuTitle: Configure
title: Configure Grafana Logs Drilldown
weight: 200
---

# Configure Grafana Logs Drilldown

You can use the Configuration page to configure the Grafana Logs Drilldown app like other apps or plugins in Grafana.
By accessing the app's Administration page, you can view the version history, changelog, configuration, landing page settings, and default fields.

## Before you begin

To access the Configuration page, you need to be an Org Admin or Server Admin role.

Only Org Admins can save changes made to the configuration settings. Server Admin alone can't configure app plugins; only install, uninstall, or update them.

In practice this means:

- _Org Admin only_ can view and configure, but can't install or update the plugin.
- _Server Admin only_ can install/update the plugin, but the **Configuration** tab settings are read-only.
- _Both roles_ have full access: configure, install, update, and uninstall.

This is a Grafana-wide rule that applies to all app plugins, not specific to Logs Drilldown. If a Server Admin needs to change the configuration settings, they need to be granted the Org Admin role in the relevant organization.

Refer to [Plugin management](https://grafana.com/docs/grafana/latest/administration/plugin-management/) for more information.

## Configuration tab

The **Configuration** tab has four settings, all aimed at an administrator setting up a consistent experience for their team:

- **Default data source**: pick which Loki instance users land on when they first open the app
- **Default time range**: override the built-in 15-minute default with a range that matches your team's workflows
- **Maximum time picker interval**: cap how far back users can query, typically to match your Loki retention period or protect query performance
- **Disable Loki patterns**: turn off the Patterns tab and API calls if your Loki instance doesn't have pattern ingestion enabled

### Configure settings

To view the **Configuration** tab:

1. Open the Grafana Logs Drilldown app's settings by navigating to **Administration** > **Plugins and data** > **Plugins** > **Grafana Logs Drilldown**.
1. Select the **Configuration** tab.

{{< admonition type="note" >}}
Active users must reload the app for configuration changes to take effect.
{{< /admonition >}}

Select a setting to configure it:

- **Default data source** sets the Loki data source used when a new user opens Logs Drilldown for the first time. Individual users can override this by selecting a different data source inside the app. Only Loki data sources are supported.

- **Default time range** controls the time range applied when a user opens Logs Drilldown without a time range already set in the URL. Select the **Use custom default time range** checkbox to enable this setting, which reveals **From** and **To** input fields. Both fields are required. Use relative time expressions such as `now-15m`, `now-1h`, or `now-24h` for the start, and `now` for the end. Absolute date-time values are also accepted. The **From** value must be earlier than the **To** value; if either value is missing or invalid, the **Save settings** button is disabled and an inline error is displayed. When disabled, the app uses its built-in default of the last 15 minutes.

- **Maximum time picker interval** sets an upper bound on the time range interval that users can select in the time picker. The minimum accepted value is one hour (`60m`). Example values: `7d`, `24h`, `2w`. If left empty, users can select any time range.

- **Disable Loki patterns** controls whether the Patterns tab and the [Loki Patterns API](https://grafana.com/docs/loki/latest/reference/loki-http-api/#patterns-detection) endpoint are used by Logs Drilldown.

After configuring a setting, click **Save settings** to apply the changes.

## Default fields (Beta)

{{< docs/public-preview product="Default fields" featureFlag="kubernetesLogsDrilldown" >}}

The **Default fields** tab lets administrators configure which fields appear by default in log visualizations instead of, or alongside, the full log line.

Default fields requires Grafana 12.4 or later. If this version requirement is not met, the **Default fields** tab displays an unsupported message.

### How Default fields work

Default field rules are scoped to a specific data source and one or more label and value pairs. When a user views logs for a service that matches all configured labels in a rule, the specified fields are displayed by default in the logs table view. The configured fields can replace the full log line or be displayed next to it.

### Configure Default fields

To configure Default fields:

1. Navigate to **Administration** > **Plugins and data** > **Plugins** > **Grafana Logs Drilldown**.
1. Select the **Default fields** tab.
1. Select a Loki data source from the data source picker.
1. Click **Add** to create a new rule.
1. Select a label and label value to define which services this rule applies to. You can add multiple label and value pairs to a single rule by clicking **Add label**.
1. Add the columns you want to display for matching services by clicking **Add column**.
1. Click **Create default columns** to save a new configuration, or **Update default columns** to save changes to an existing one.

You can add multiple records to configure different columns for different label and value combinations. Each data source can have its own set of rules.

<!-- Uncomment the following section when Grafana 13.0 is released.

## Landing Page default labels (Beta)

{{< docs/public-preview product="Landing Page default labels" featureFlag="kubernetesLogsDrilldown" >}}

The **Landing Page** tab lets administrators configure which labels and label values appear by default on the Logs Drilldown landing page.

Landing Page default labels requires Grafana 13.0 or later. If this version requirement is not met, the **Landing Page** tab displays an unsupported message.

### How Landing Page default labels work

By default, Logs Drilldown organizes the landing page by `service_name`. If your environment uses a different label to identify services, such as `app`, `namespace`, `cluster`, or a custom label, you can configure the landing page to show those labels instead. This ensures users see a meaningful service list immediately, without having to add labels manually.

Landing page label configuration is per data source. Each Loki data source can have independent default label settings.

When default labels are configured:

- The configured labels appear as pinned tabs on the landing page. End users cannot remove these tabs.
- The first label in the list becomes the default active tab when users open Logs Drilldown.
- When specific values are pinned for a label, only those values appear on the landing page.
- When no values are pinned for a label, all values from the volume API are displayed.
- Default label values are excluded from the favorites toggle.
- When no labels are configured, Logs Drilldown falls back to `service_name`.

### Configure Landing Page default labels

To configure Landing Page default labels:

1. Navigate to **Administration** > **Plugins and data** > **Plugins** > **Grafana Logs Drilldown**.
1. Select the **Landing Page** tab.
1. Select a Loki data source from the data source picker. Each data source has independent configuration.
1. In the **Select label name** field, choose a label from the suggestions or type a custom label name.
1. (Optional) After selecting a label, a **Select values (optional)** multi-select field appears. Choose specific values to pin, or leave it empty to show all values for that label on the landing page.
1. Click **Add label** (or **Add label and values** if values were selected).
1. Repeat steps 4-6 to add more labels.
1. Drag and drop labels using the grip handle to reorder them. The first label in the list becomes the default active tab on the landing page.
1. To remove a label, click the trash icon next to it. To remove an individual pinned value, expand the label and click the trash icon next to the value.
1. Click **Save changes** to persist your configuration. Click **Reset** to discard unsaved changes (a confirmation prompt appears before resetting).

End section for Grafana 13 requirement -->

## Related pages

- [Access and install Grafana Logs Drilldown](../../access/)
- [Get started with Grafana Logs Drilldown](../../get-started/)
- [Troubleshooting](../../troubleshooting/)
