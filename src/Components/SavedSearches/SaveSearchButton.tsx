import React, { useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { sceneGraph, SceneObject } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

import { SaveSearchModal } from './SaveSearchModal';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { useInitSavedSearch } from 'services/saveSearch';
import { getDataSourceVariable } from 'services/variableGetters';

interface Props {
  sceneRef: SceneObject;
}

export function SaveSearchButton({ sceneRef }: Props) {
  const [saving, setSaving] = useState(false);

  const dsUid = useMemo(() => {
    const ds = getDataSourceVariable(sceneRef);
    return ds.getValue().toString();
  }, [sceneRef]);

  useInitSavedSearch(dsUid);

  const embedded = useMemo(() => sceneGraph.getAncestor(sceneRef, IndexScene).state.embedded, [sceneRef]);
  if (embedded) {
    return null;
  }

  return (
    <>
      <ToolbarButton
        variant="canvas"
        icon="save"
        onClick={() => setSaving(true)}
        tooltip={t('logs.logs-drilldown.save-search.button-tooltip', 'Save search')}
      />
      {saving && <SaveSearchModal dsUid={dsUid} sceneRef={sceneRef} onClose={() => setSaving(false)} />}
    </>
  );
}
