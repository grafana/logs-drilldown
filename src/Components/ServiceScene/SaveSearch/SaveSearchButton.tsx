import React, { useState } from 'react';

import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

import { SaveSearchModal } from './SaveSearchModal';

export function SaveSearchButton() {
  const [saving, setSaving] = useState(false);

  return (
    <>
      <ToolbarButton
        variant="canvas"
        icon="save"
        onClick={() => setSaving(true)}
        tooltip={t('logs.logs-drilldown.save-search.button', 'Save search')}
      />
      {saving && <SaveSearchModal onClose={() => setSaving(false)} />}
    </>
  );
}
