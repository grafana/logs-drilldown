import React from 'react';

import { jsonLabelWrapStyles } from '../../../services/JSONViz';

interface Props {
  keyPathString: string | number;
  text: Array<string | React.JSX.Element>;
}

export function JSONLabelText({ text, keyPathString }: Props) {
  return <strong className={jsonLabelWrapStyles}>{text.length ? text : keyPathString}:</strong>;
}
