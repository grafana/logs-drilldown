import React, { useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { usePluginComponent } from '@grafana/runtime';
import { sceneGraph, SceneObject } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

import { SaveSearchModal } from './SaveSearchModal';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { LokiQuery } from 'services/lokiQuery';
import { isQueryLibrarySupported, OpenQueryLibraryComponentProps } from 'services/saveSearch';
import { getQueryExpr } from 'services/scenes';
import { getDataSourceVariable } from 'services/variableGetters';

interface Props {
  sceneRef: SceneObject;
}

export function SaveSearchButton({ sceneRef }: Props) {
  const [saving, setSaving] = useState(false);
  const { component: OpenQueryLibraryComponent, isLoading: isLoadingExposedComponent } =
    usePluginComponent<OpenQueryLibraryComponentProps>('grafana/query-library-context/v1');

  const dsUid = useMemo(() => {
    const ds = getDataSourceVariable(sceneRef);
    return ds.getValue().toString();
  }, [sceneRef]);

  const dsName = useMemo(() => {
    const ds = getDataSourceVariable(sceneRef);
    return ds.state.text.toString();
  }, [sceneRef]);

  const indexScene = useMemo(() => sceneGraph.getAncestor(sceneRef, IndexScene), [sceneRef]);

  const fallbackComponent = useMemo(
    () => (
      <>
        <ToolbarButton
          variant="canvas"
          icon="save"
          onClick={() => setSaving(true)}
          tooltip={t('logs.logs-drilldown.save-search.button-tooltip', 'Save search')}
        />
        {saving && <SaveSearchModal dsUid={dsUid} sceneRef={sceneRef} onClose={() => setSaving(false)} />}
      </>
    ),
    [dsUid, saving, sceneRef]
  );

  const expr = useMemo(() => getQueryExpr(indexScene), [indexScene]);

  const query: LokiQuery = useMemo(
    () => ({
      refId: 'drilldown',
      datasource: {
        type: 'loki',
        uid: dsUid,
      },
      expr,
    }),
    [dsUid, expr]
  );

  if (indexScene.state.embedded || isLoadingExposedComponent || !OpenQueryLibraryComponent) {
    return null;
  }

  if (!isQueryLibrarySupported()) {
    return fallbackComponent;
  }

  return (
    <OpenQueryLibraryComponent
      datasourceFilters={[dsName]}
      query={query}
      tooltip={t('logs.logs-drilldown.save-search.button-tooltip-saved-queries', 'Save in Saved Queries')}
    />
  );
}
