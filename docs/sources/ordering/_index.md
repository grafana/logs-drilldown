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
weight: 700
---

# Sorting and ordering

By default the graphs are sorted by most relevant, where we prioritise graphs with more volatile data or the largest volume of data. For example, the graphs with the most spikes or dips will be shown first.

Some pages in Grafana Logs Drilldown can display a large number of graphs. You may want to sort the graphs differently, depending on what you're looking for.

On the **Label** tab, you can use the **Newest first** and **Oldest first** buttons to change the direction of the sort in the Logs view.

<!-- Make updating the screenshots easier by putting the Logs Drilldown version in the file name. This lets everyone know the last time the screenshots were updated.-->
{{< figure alt="Sort by many" caption="Sort by menu" width="900px" align="center" src="/media/docs/explore-logs/sort-by-menu_v1.0.14.png" >}}

When there is an option to sort the graphs, there are several different ways you can sort your log data.

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
