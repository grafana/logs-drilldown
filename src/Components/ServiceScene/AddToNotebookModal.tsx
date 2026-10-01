import React, { createElement } from 'react';

import { t } from '@grafana/i18n';
import { reportInteraction, usePluginComponent } from '@grafana/runtime';
import { Panel } from '@grafana/schema';
import { Modal } from '@grafana/ui';

import { AddToDashboardData } from 'Components/Panels/PanelMenu';

interface AddToNotebookFormProps {
  buildPanel(): Panel;
  onClose(): void;
}

export const AddToNotebookModal = ({ data, onClose }: { data: AddToDashboardData; onClose(): void }) => {
  const { component: AddToNotebookComponent, isLoading } = usePluginComponent('grafana/add-to-notebook-form/v1');

  if (isLoading) {
    return;
  }

  return (
    <Modal
      title={t('components.service-scene.add-to-notebook-modal.title', 'Add to Notebook')}
      isOpen={true}
      onDismiss={onClose}
    >
      {createElement(AddToNotebookComponent as React.ComponentType<AddToNotebookFormProps>, {
        onClose: onClose,
        buildPanel: () => {
          reportInteraction('grafana_logs_app_add_panel_to_notebook', { type: data.panel.type });
          return data.panel;
        },
      })}
    </Modal>
  );
};
