import React from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';

import { addJsonFilter } from '../../../services/JSONFilter';
import { jsonLabelButtonsWrapStyle, jsonLabelWrapStyles } from '../../../services/JSONViz';
import { LogsJsonScene } from '../LogsJsonScene';
import { JSONFilterValueButton } from './JSONFilterValueButton';
import { KeyPath } from '@gtk-grafana/react-json-tree';

interface Props {
  addFilter: typeof addJsonFilter;
  elements: Array<string | React.JSX.Element>;
  existingFilter?: AdHocFilterWithLabels;
  fullKey: string;
  fullKeyPath: KeyPath;
  jsonFiltersSupported: boolean | undefined;
  keyPathString: string | number;
  label: string | number;
  model: LogsJsonScene;
  value: string;
}

export function ValueNodeLabelButtons({
  jsonFiltersSupported,
  label,
  value,
  fullKeyPath,
  fullKey,
  addFilter,
  existingFilter,
  elements,
  keyPathString,
  model,
}: Props) {
  return (
    <span className={jsonLabelButtonsWrapStyle}>
      {jsonFiltersSupported && (
        <>
          <JSONFilterValueButton
            label={label}
            value={value}
            keyPath={fullKeyPath}
            fullKey={fullKey}
            addFilter={addFilter}
            existingFilter={existingFilter}
            type={'include'}
            model={model}
          />
          <JSONFilterValueButton
            label={label}
            value={value}
            keyPath={fullKeyPath}
            fullKey={fullKey}
            addFilter={addFilter}
            existingFilter={existingFilter}
            type={'exclude'}
            model={model}
          />
        </>
      )}

      <strong className={jsonLabelWrapStyles}>{elements.length ? elements : keyPathString}:</strong>
    </span>
  );
}
