import React, { useState } from 'react';

import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

export function SaveSearchButton() {
  const [saving, setSaving] = useState(false);

  return (
    <>
      <ToolbarButton
        variant="canvas"
        icon="save"
        onClick={() => {}}
        tooltip={t('logs.logs-drilldown-header.expand', 'Save search')}
      />
    </>
  );
}
