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
}

export default function ErrorsAnalysis(props: ErrorsAnalysisProps) {
  return <AttributeDistribution {...props} />;
}
