import React from 'react';

import { usePluginComponent } from '@grafana/runtime';
import { DataQuery, DataSourceRef } from '@grafana/schema';

import { CreateAlertData } from 'Components/Panels/PanelMenu';

interface CreateAlertFromPanelProps {
  onDismiss: () => void;
  panel: {
    datasource?: DataSourceRef;
    maxDataPoints?: number;
    targets: DataQuery[];
    title?: string;
  };
}

export const CreateAlertModal = ({ data, onDismiss }: { data: CreateAlertData; onDismiss(): void }) => {
  const { component: CreateAlertComponent, isLoading } = usePluginComponent<CreateAlertFromPanelProps>(
    'grafana/alerting/create-alert-from-panel/v1'
  );

  if (isLoading || !CreateAlertComponent) {
    return null;
  }

  const panelData: CreateAlertFromPanelProps['panel'] = {
    targets: (data.panel.targets as DataQuery[] | undefined) ?? [],
    datasource: typeof data.panel.datasource === 'object' ? data.panel.datasource : undefined,
    maxDataPoints: data.panel.maxDataPoints,
    title: data.panel.title,
  };

  return <CreateAlertComponent panel={panelData} onDismiss={onDismiss} />;
};
