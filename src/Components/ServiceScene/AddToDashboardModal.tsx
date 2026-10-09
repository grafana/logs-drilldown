import React from 'react';

import { TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction, usePluginComponent } from '@grafana/runtime';
import { Panel } from '@grafana/schema';
import { Modal } from '@grafana/ui';

import { AddToDashboardData } from 'Components/Panels/PanelMenu';

interface AddToDashboardFormProps {
  buildPanel(): Panel;
  onClose(): void;
  options?: { useAbsolutePath: boolean };
  timeRange?: TimeRange;
}

export const AddToDashboardModal = ({ data, onClose }: { data: AddToDashboardData; onClose(): void }) => {
  const { component: AddToDashboardComponent, isLoading } = usePluginComponent<AddToDashboardFormProps>(
    'grafana/add-to-dashboard-form/v1'
  );

  if (isLoading || !AddToDashboardComponent) {
    return;
  }

  return (
    <Modal
      title={t('components.service-scene.add-to-dashboard-modal.title', 'Add to Dashboard')}
      isOpen={true}
      onDismiss={onClose}
    >
      <AddToDashboardComponent
        onClose={onClose}
        buildPanel={() => {
          reportInteraction('grafana_logs_app_add_panel_to_dashboard', { type: data.panel.type });
          return data.panel;
        }}
        timeRange={data.timeRange}
        options={{ useAbsolutePath: true }}
      />
    </Modal>
  );
};
