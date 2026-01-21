import React, { useCallback, useMemo } from 'react';

import { css } from '@emotion/css';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents, locationService, usePluginComponent } from '@grafana/runtime';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ToolbarButton, useStyles2 } from '@grafana/ui';

import { LoadSearchModal } from './LoadSearchModal';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { contextToLink } from 'services/extensions/links';
import { LokiQuery } from 'services/lokiQuery';
import { isQueryLibrarySupported, OpenQueryLibraryComponentProps, useHasSavedSearches } from 'services/saveSearch';
import { getDataSourceVariable } from 'services/variableGetters';

export interface LoadSearchSceneState extends SceneObjectState {
  dsName: string;
  dsUid: string;
  isOpen: boolean;
}
export class LoadSearchScene extends SceneObjectBase<LoadSearchSceneState> {
  constructor(state: Partial<LoadSearchSceneState> = {}) {
    super({
      dsUid: '',
      dsName: '',
      isOpen: false,
      ...state,
    });

    this.addActivationHandler(this.onActivate);
  }

  onActivate = () => {
    this.setState({
      dsUid: getDataSourceVariable(this).getValue().toString(),
      dsName: getDataSourceVariable(this).state.text.toString(),
    });

    this._subs.add(
      getDataSourceVariable(this).subscribeToState((newState) => {
        this.setState({
          dsUid: newState.value.toString(),
          dsName: getDataSourceVariable(this).state.text.toString(),
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
    const { dsName, dsUid, isOpen } = model.useState();
    const styles = useStyles2(getStyles);
    const hasSavedSearches = useHasSavedSearches(dsUid);

    const { component: OpenQueryLibraryComponent, isLoading: isLoadingExposedComponent } =
      usePluginComponent<OpenQueryLibraryComponentProps>('grafana/query-library-context/v1');

    const indexScene = useMemo(() => sceneGraph.getAncestor(model, IndexScene), [model]);
    const sceneTimeRange = useMemo(() => sceneGraph.getTimeRange(indexScene).state.value, [indexScene]);

    const fallbackComponent = useMemo(
      () => (
        <>
          <ToolbarButton
            icon="folder-open"
            variant="canvas"
            disabled={!hasSavedSearches}
            onClick={model.toggleOpen}
            className={styles.button}
            tooltip={
              hasSavedSearches
                ? t('logs.logs-drilldown.load-search.button-tooltip', 'Load saved search')
                : t('logs.logs-drilldown.load-search.button-no-search-tooltip', 'No saved searches to load')
            }
          />
          {isOpen && <LoadSearchModal sceneRef={model} onClose={model.toggleClosed} />}
        </>
      ),
      [hasSavedSearches, isOpen, model, styles.button]
    );

    const onSelectQuery = useCallback(
      (query: LokiQuery) => {
        const appEvents = getAppEvents();

        if (query.datasource?.type !== 'loki') {
          appEvents.publish({
            payload: [t('logs.logs-drilldown.save-search.load-type-error', 'Please select a Loki query.')],
            type: AppEvents.alertError.name,
          });
          return;
        }

        const link =
          contextToLink({
            targets: [
              {
                refId: 'A',
                datasource: {
                  uid: query.datasource?.uid,
                  type: 'loki',
                },
                // @ts-expect-error
                expr: query.expr,
              },
            ],
            timeRange: sceneTimeRange,
          })?.path ?? '';

        if (link) {
          locationService.push(link);
        } else {
          appEvents.publish({
            payload: [t('logs.logs-drilldown.save-search.load-error', 'Could not generate a link.')],
            type: AppEvents.alertError.name,
          });
        }
      },
      [sceneTimeRange]
    );

    if (!isQueryLibrarySupported()) {
      return fallbackComponent;
    }

    if (isLoadingExposedComponent || indexScene.state.embedded || !OpenQueryLibraryComponent) {
      return null;
    }

    return (
      <OpenQueryLibraryComponent
        datasourceFilters={[dsName]}
        icon="folder-open"
        onSelectQuery={onSelectQuery}
        tooltip={t('logs.logs-drilldown.load-search.saved-query-button-tooltip', 'Load saved query')}
      />
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  button: css({
    [theme.breakpoints.down('lg')]: {
      alignSelf: 'flex-start',
    },
    alignSelf: 'flex-end',
  }),
});
