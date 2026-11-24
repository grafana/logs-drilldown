import React, { useEffect, useMemo, useRef, useState } from 'react';

import { css } from '@emotion/css';

import { dateTime, FieldType, GrafanaTheme2, LoadingState, TimeRange } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { LegendDisplayMode, useStyles2 } from '@grafana/ui';

import type { PatternFrame } from 'services/patterns';
import { testIds } from 'services/testIds';

export function Volume({
  patterns,
  range,
  onTimeRangeChange,
}: {
  onTimeRangeChange?: (range: TimeRange) => void;
  patterns: PatternFrame[];
  range: TimeRange;
}) {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  const data = useMemo(
    () => ({
      series: patterns.map(({ dataFrame }) => ({
        ...dataFrame,
        fields: dataFrame.fields.map((field) => (field.type === FieldType.number ? { ...field, name: '' } : field)),
      })),
      state: LoadingState.Done,
      timeRange: range,
    }),
    [patterns, range]
  );

  return (
    <div ref={ref} className={styles.volume} data-testid={testIds.exposedComponents.patterns.volume}>
      {size.width > 0 && size.height > 0 && (
        <PanelRenderer
          pluginId="timeseries"
          title=""
          width={size.width}
          height={size.height}
          timeZone="browser"
          data={data}
          fieldConfig={{ defaults: { unit: 'short' }, overrides: [] }}
          options={{
            annotations: { multiLane: true },
            legend: {
              displayMode: size.width >= 830 ? LegendDisplayMode.Table : LegendDisplayMode.List,
              placement: size.width >= 830 ? 'right' : 'bottom',
              width: size.width >= 830 ? 200 : undefined,
              showLegend: true,
              calcs: [],
            },
          }}
          onChangeTimeRange={
            onTimeRangeChange
              ? ({ from, to }) => {
                  const next = { from: dateTime(from), to: dateTime(to) };
                  onTimeRangeChange({ ...next, raw: next });
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  volume: css({
    width: '100%',
    height: 'clamp(180px, 22cqw, 300px)',
    minWidth: 0,
    padding: theme.spacing(1),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.primary,
    boxSizing: 'border-box',
  }),
});
