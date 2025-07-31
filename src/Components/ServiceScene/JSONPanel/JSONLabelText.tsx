import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { getJSONLabelWrapStyles } from 'services/JSONViz';

interface Props {
  keyPathString: string | number;
  text: Array<string | React.JSX.Element>;
}

export function JSONLabelText({ text, keyPathString }: Props) {
  const styles = useStyles2(getJSONLabelWrapStyles);
  return <strong className={styles.JSONLabelWrapStyles}>{text.length ? text : keyPathString}:</strong>;
}
