---
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/ordering/
description: Learn about sorting and ordering data in Grafana Logs Drilldown.
keywords:
  - Logs
  - Log Patterns
  - Explore
  - Patterns
  - Drain
  - Categorization
  - Analysis
menuTitle: Sorting and ordering
title: Sorting and ordering
weight: 850
---

# Sorting and ordering

By default, graphs are sorted by most relevant, which prioritizes graphs with more volatile data or higher volume. For example, graphs with the most spikes or dips appear first.

Some pages in Grafana Logs Drilldown can display a large number of graphs. You may want to sort the graphs differently, depending on what you're looking for.

## Sorting log lines

When viewing log lines, you can use the **Sort direction** control in the log controls panel to change the display order:

- **Newest logs first** (descending): Shows the most recent log lines at the top.
- **Oldest logs first** (ascending): Shows the oldest log lines at the top.

The log controls can be accessed by clicking the expand/collapse button on the right side of the logs panel. For more information about log controls, refer to [View logs](../view-logs/).

When using infinite scroll to load more results, the sort direction determines which logs are loaded next:

- **Newest logs first**: Scrolling to the bottom loads older logs.
- **Oldest logs first**: Scrolling to the bottom loads newer logs.

## Sorting visualizations

<!-- Make updating the screenshots easier by putting the Logs Drilldown version in the file name. This lets everyone know the last time the screenshots were updated.-->

{{< figure alt="Sorting in Grafana Logs Drilldown" caption="Sorting controls" width="900px" align="center" src="/media/docs/explore-logs/v2/logs-drilldown-sort-by-menu.png" >}}

After selecting a specific label or field, you can sort graphs. Depending on the page and visualization, several sort options can be available.

Some pages let you modify sort order directly from table or panel sort controls.
For example, on the **Patterns** tab, you can sort by clicking the **Count** or **%** column headers. On the **Labels** and **Fields** tabs, a **Sort by** dropdown appears after you select a specific label or field.

| Sort by option  | Description                                                                |
| --------------- | -------------------------------------------------------------------------- |
| Most relevant   | Sorts graphs based on the most significant spikes in data.                 |
| Outlying values | Sorts graphs by the amount of outlying values in the data.                 |
| Widest spread   | Sorts graphs by deviation from the average value.                          |
| Name            | Sorts graphs alphabetically by name.                                       |
| Count           | Sorts graphs by total number of logs.                                      |
| Highest spike   | Sorts graphs by the highest values (max).                                  |
| Lowest dip      | Sorts graphs by the smallest values (min).                                 |
| Percentiles     | Sorts graphs by supported percentiles (`p10`, `p25`, `p75`, `p90`, `p99`). |

{{< admonition type="note" >}}
We are keen to improve this feature. [Contact us](https://forms.gle/1sYWCTPvD72T1dPH9) if there is something that would help you find the signal in the noise.
{{< /admonition >}}
