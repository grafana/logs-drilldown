import React from 'react';

import { ControlsLabel, SceneDataLayerSet, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { InlineSwitch } from '@grafana/ui';

export interface KgAnnotationToggleState extends SceneObjectState {
  isEnabled: boolean;
  layerSet: SceneDataLayerSet;
}

export class KgAnnotationToggle extends SceneObjectBase<KgAnnotationToggleState> {
  static Component = KgAnnotationToggleRenderer;

  public toggleEnabled = () => {
    const next = !this.state.isEnabled;
    this.setState({ isEnabled: next });
    for (const layer of this.state.layerSet.state.layers) {
      layer.setState({ isEnabled: next });
    }
  };
}

function KgAnnotationToggleRenderer({ model }: { model: KgAnnotationToggle }) {
  const { isEnabled } = model.useState();
  return (
    <div style={{ display: 'flex' }}>
      <ControlsLabel label="Insights" />
      <InlineSwitch value={isEnabled} onChange={model.toggleEnabled} />
    </div>
  );
}
