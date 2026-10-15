import React from 'react';

import { t } from '@grafana/i18n';
import { reportInteraction, usePluginComponent } from '@grafana/runtime';
import { Panel } from '@grafana/schema';
import { Modal } from '@grafana/ui';

import { AddToNotebookData, CapturedTimeRange } from 'Components/Panels/PanelMenu';

interface AddToNotebookFormProps {
  buildPanel(): Panel;
  capturedTimeRange: CapturedTimeRange;
  onClose(): void;
}

export const AddToNotebookModal = ({ data, onClose }: { data: AddToNotebookData; onClose(): void }) => {
  const { component: AddToNotebookComponent, isLoading } = usePluginComponent<AddToNotebookFormProps>(
    'grafana/add-to-notebook-form/v1'
  );

  if (isLoading || !AddToNotebookComponent) {
    return;
  }

  return (
    <Modal
      title={t('components.service-scene.add-to-notebook-modal.title', 'Add to Notebook')}
      isOpen={true}
      onDismiss={onClose}
    >
      <AddToNotebookComponent
        onClose={onClose}
        capturedTimeRange={data.capturedTimeRange}
        buildPanel={() => {
          reportInteraction('grafana_logs_app_add_panel_to_notebook', { type: data.panel.type });
          return data.panel;
        }}
      />
    </Modal>
  );
};
