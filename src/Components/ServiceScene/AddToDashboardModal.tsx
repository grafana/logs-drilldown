import React, { createElement } from 'react';

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
  const { component: AddToDashboardComponent, isLoading } = usePluginComponent('grafana/add-to-dashboard-form/v1');

  if (isLoading) {
    return;
  }

  return (
    <Modal
      title={t('logs.logs-drilldown.add-to-dashboard.title', 'Add to Dashboard')}
      isOpen={true}
      onDismiss={onClose}
    >
      {createElement(AddToDashboardComponent as React.ComponentType<AddToDashboardFormProps>, {
        onClose: onClose,
        buildPanel: () => {
          reportInteraction('grafana_logs_app_add_panel_to_dashboard', { type: data.panel.type });
          return data.panel;
        },
        timeRange: data.timeRange,
        options: { useAbsolutePath: true },
      })}
    </Modal>
  );
};
