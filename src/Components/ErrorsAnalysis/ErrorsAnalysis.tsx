import React from 'react';

import { AttributeDistribution } from './AttributeDistribution';

export interface ErrorsAnalysisProps {
  appId: string;
  datasourceUid: string;
  errorHash: string;
  timeRange: { from: number; to: number };
  onFilterApply?: (label: string, value: string) => void;
  // Optional ordered list of attributes to pin first in the distribution sidebar.
  // Defined by the consuming app -- logs-drilldown imposes no default ordering.
  // If not provided, detected fields appear in Loki's returned order.
  priorityAttributes?: Array<{ field: string; label: string }>;
  // Optional label shown at the top of the sidebar communicating the dataset scope.
  // Set this when the underlying query caps the number of events so users understand
  // the distributions are based on a sample. Example: "Last 1000 logs"
  // The consuming app sets this -- it knows what limit its query applies.
  queryLimitLabel?: string;
}

export default function ErrorsAnalysis(props: ErrorsAnalysisProps) {
  return <AttributeDistribution {...props} />;
}
