import React from 'react';

import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

import { LoadSearchModal } from './LoadSearchModal';
import { hasSavedSearches } from 'services/saveSearch';
import { getDataSourceVariable } from 'services/variableGetters';

export interface LoadSearchSceneState extends SceneObjectState {
  hasSavedSearches: boolean;
  isOpen: boolean;
}
export class LoadSearchScene extends SceneObjectBase<LoadSearchSceneState> {
  constructor(state: Partial<LoadSearchSceneState> = {}) {
    super({
      hasSavedSearches: false,
      isOpen: false,
      ...state,
    });

    this.addActivationHandler(this.onActivate);
  }

  onActivate = () => {
    const dsUid = getDataSourceVariable(this).getValue().toString();
    hasSavedSearches(dsUid).then((hasSavedSearches) => {
      this.setState({ ...this.state, hasSavedSearches });
    });
  };

  toggleOpen = () => {
    this.setState({
      isOpen: true,
    });
  };

  toggleClosed = () => {
    this.setState({
      isOpen: false,
    });
  };

  static Component = ({ model }: SceneComponentProps<LoadSearchScene>) => {
    const { isOpen, hasSavedSearches } = model.useState();

    return (
      <>
        <ToolbarButton
          icon="folder-open"
          variant="canvas"
          disabled={!hasSavedSearches}
          onClick={model.toggleOpen}
          tooltip={
            hasSavedSearches
              ? t('logs.logs-drilldown.load-search.button-tooltip', 'Load saved search')
              : t('logs.logs-drilldown.load-search.button-no-search-tooltip', 'No saved searches to load')
          }
        />
        {isOpen && <LoadSearchModal sceneRef={model} onClose={model.toggleClosed} />}
      </>
    );
  };
}
