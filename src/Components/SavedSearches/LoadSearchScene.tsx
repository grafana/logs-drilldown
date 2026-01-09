import React from 'react';

import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

import { LoadSearchModal } from './LoadSearchModal';
import { useHasSavedSearches } from 'services/saveSearch';
import { getDataSourceVariable } from 'services/variableGetters';

export interface LoadSearchSceneState extends SceneObjectState {
  dsUid: string;
  isOpen: boolean;
}
export class LoadSearchScene extends SceneObjectBase<LoadSearchSceneState> {
  constructor(state: Partial<LoadSearchSceneState> = {}) {
    super({
      dsUid: '',
      isOpen: false,
      ...state,
    });

    this.addActivationHandler(this.onActivate);
  }

  onActivate = () => {
    this.setState({
      dsUid: getDataSourceVariable(this).getValue().toString(),
    });

    this._subs.add(
      getDataSourceVariable(this).subscribeToState((newState) => {
        this.setState({
          dsUid: newState.value.toString(),
        });
      })
    );
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
    const { dsUid, isOpen } = model.useState();
    const hasSavedSearches = useHasSavedSearches(dsUid);

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
