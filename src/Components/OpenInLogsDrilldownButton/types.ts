import { AbstractLabelMatcher } from '@grafana/data';

export interface OpenInLogsDrilldownButtonProps {
  datasourceUid?: string;
  from?: string;
  renderButton?: (props: { href: string }) => React.ReactElement<any>;
  returnToPreviousSource?: string;
  streamSelectors: AbstractLabelMatcher[];
  to?: string;
}
