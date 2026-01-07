import React, { useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { sceneGraph, SceneObject } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

import { SaveSearchModal } from './SaveSearchModal';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { getQueryExpr } from 'services/scenes';

interface Props {
  sceneRef: SceneObject;
}

export function SaveSearchButton({ sceneRef }: Props) {
  const [saving, setSaving] = useState(false);

  const query = useMemo(() => {
    const indexScene = sceneGraph.getAncestor(sceneRef, IndexScene);
    return getQueryExpr(indexScene);
  }, [sceneRef]);

  return (
    <>
      <ToolbarButton
        variant="canvas"
        icon="save"
        onClick={() => setSaving(true)}
        tooltip={t('logs.logs-drilldown.save-search.button', 'Save search')}
      />
      {saving && <SaveSearchModal query={query} onClose={() => setSaving(false)} />}
    </>
  );
}
