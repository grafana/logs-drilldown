import React, { useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

import { SaveSearchModal } from './SaveSearchModal';
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
