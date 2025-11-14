import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

import { TimeSeriesQueryType } from '../../Panels/PanelMenu';

export interface FieldsVizPanelWrapperState extends SceneObjectState {
  // panelType: TimeSeriesPanelType;
  queryType: TimeSeriesQueryType;
  supportsHistogram: boolean;
  viz: VizPanel;
}

export class FieldsVizPanelWrapper extends SceneObjectBase<FieldsVizPanelWrapperState> {
  constructor(state: FieldsVizPanelWrapperState) {
    super(state);
  }

  public static Component = ({ model }: SceneComponentProps<FieldsVizPanelWrapper>) => {
    const { viz } = model.useState();
    return <viz.Component model={viz} />;
  };
}
