import React from 'react';

import { AttributeDistribution } from './AttributeDistribution';

export interface ErrorsAnalysisProps {
  appId: string;
  datasourceUid: string;
  errorHash: string;
  timeRange: { from: number; to: number };
  onFilterApply?: (label: string, value: string) => void;
}

export default function ErrorsAnalysis(props: ErrorsAnalysisProps) {
  return <AttributeDistribution {...props} />;
}
