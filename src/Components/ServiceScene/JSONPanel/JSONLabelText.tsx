import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { getJsonLabelWrapStyles } from 'services/JSONViz';

interface Props {
  keyPathString: string | number;
  text: Array<string | React.JSX.Element>;
}

export function JSONLabelText({ text, keyPathString }: Props) {
  const styles = useStyles2(getJsonLabelWrapStyles);
  return <strong className={styles.jsonLabelWrapStyles}>{text.length ? text : keyPathString}:</strong>;
}
