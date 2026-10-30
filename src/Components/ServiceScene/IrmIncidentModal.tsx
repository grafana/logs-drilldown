import React from 'react';

import { t } from '@grafana/i18n';
import { usePluginComponent } from '@grafana/runtime';
import { Modal } from '@grafana/ui';

import { IrmAction } from 'Components/Panels/PanelMenu';

interface AttachIncidentProps {
  attachURL: string;
  defaultCaption: string;
  onDismiss: () => void;
}

interface DeclareIncidentProps {
  attachCaption: string;
  attachURL: string;
  onDismiss: () => void;
}

export function IrmIncidentModal({ data, onDismiss }: { data: IrmAction; onDismiss: () => void }) {
  const { component: Attach, isLoading: isLoadingAttach } = usePluginComponent<AttachIncidentProps>(
    'grafana-irm-app/attach-to-incident-modal/v1'
  );
  const { component: Declare, isLoading: isLoadingDeclare } = usePluginComponent<DeclareIncidentProps>(
    'grafana-irm-app/declare-incident-modal/v1'
  );

  if (data.type === 'attach') {
    if (isLoadingAttach || !Attach) {
      return null;
    }
    return (
      <Modal title={t('irm.attach', 'Attach to incident')} isOpen onDismiss={onDismiss}>
        <Attach attachURL={data.context.url} defaultCaption={data.context.caption} onDismiss={onDismiss} />
      </Modal>
    );
  }
  if (isLoadingDeclare || !Declare) {
    return null;
  }
  return <Declare attachURL={data.context.url} attachCaption={data.context.caption} onDismiss={onDismiss} />;
}
