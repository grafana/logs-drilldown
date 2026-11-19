import { FieldType, getDefaultTimeRange, LoadingState, ThresholdsMode, toDataFrame } from '@grafana/data';
import { PanelBuilders, SceneDataNode, VizPanel } from '@grafana/scenes';

function buildScoreDataNode(score: number): SceneDataNode {
  return new SceneDataNode({
    data: {
      series: [
        toDataFrame({
          fields: [{ name: 'Score', type: FieldType.number, values: [score] }],
        }),
      ],
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
    },
  });
}

// Reuses Grafana's own gauge visualization instead of a custom SVG, so it inherits the host's
// theme, threshold rendering, and accessibility behavior for free. Rendered directly (no
// SceneFlexLayout wrapper): VizPanel measures its own DOM container via ResizeObserver, whereas
// SceneFlexLayout only applies its height/width when it has a flex parentState to size against.
export function buildEfficiencyGaugePanel(score: number, summary: string): VizPanel {
  return PanelBuilders.gauge()
    .setData(buildScoreDataNode(score))
    .setDisplayName(summary)
    .setHoverHeader(true)
    .setMax(100)
    .setMin(0)
    .setNoValue('N/A')
    .setThresholds({
      mode: ThresholdsMode.Absolute,
      steps: [
        { color: 'red', value: 0 },
        { color: 'orange', value: 50 },
        { color: 'green', value: 80 },
      ],
    })
    .setUnit('short')
    .build();
}
