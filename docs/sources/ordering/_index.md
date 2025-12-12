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

By default the graphs are sorted by most relevant, where we prioritise graphs with more volatile data or the largest volume of data. For example, the graphs with the most spikes or dips will be shown first.

Some pages in Grafana Logs Drilldown can display a large number of graphs. You may want to sort the graphs differently, depending on what you're looking for.

## Sorting log lines

When viewing log lines, you can use the **Sort direction** control in the log controls panel to change the order logs are displayed:

- **Newest logs first** (descending): Shows the most recent log lines at the top.
- **Oldest logs first** (ascending): Shows the oldest log lines at the top.

The log controls can be accessed by clicking the expand/collapse button on the right side of the logs panel. For more information about log controls, refer to [View logs](../view-logs/).

When using infinite scroll to load more results, the sort direction determines which logs are loaded next:
- **Newest logs first**: Scrolling to the bottom loads older logs.
- **Oldest logs first**: Scrolling to the bottom loads newer logs.

## Sorting visualizations

<!-- Make updating the screenshots easier by putting the Logs Drilldown version in the file name. This lets everyone know the last time the screenshots were updated.-->

{{< figure alt="Sort by many" caption="Sort by menu" width="900px" align="center" src="/media/docs/explore-logs/sort-by-menu_v1.0.14.png" >}}

Once you select a specific label or field, you can sort the graphs. When you have the option to sort graphs, there are several different ways you can sort your log data.

Some pages let you modify the default sort order using the **Sort by** menu in the top right toolbar.

| Sort by option  | Description                                                |
| --------------- | ---------------------------------------------------------- |
| Most relevant   | Sorts graphs based on the most significant spikes in data. |
| Outlying values | Sorts graphs by the amount of outlying values in the data. |
| Widest spread   | Sorts graphs by deviation from the average value.          |
| Name            | Sorts graphs alphabetically by name.                       |
| Count           | Sorts graphs by total number of logs.                      |
| Highest spike   | Sorts graphs by the highest values (max).                  |
| Lowest dip      | Sorts graphs by the smallest values (min).                 |
| Percentiles     | Sorts graphs by the nth percentile.                        |

{{< admonition type="note" >}}
We are keen to improve this feature, so please [contact us](https://forms.gle/1sYWCTPvD72T1dPH9) if there is something that would help you find the signal in the noise.
{{< /admonition >}}
