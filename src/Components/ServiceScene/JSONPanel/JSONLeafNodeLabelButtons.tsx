import React from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';

import { JSONLogsScene } from '../JSONLogsScene';
import { JSONFieldValueButton } from './JSONFilterButtons';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { addJsonFieldFilter } from 'services/JSONFilter';

interface Props {
  addJsonFilter: typeof addJsonFieldFilter;
  elements: Array<string | React.JSX.Element>;
  existingFilter?: AdHocFilterWithLabels;
  fullKey: string;
  fullKeyPath: KeyPath;
  jsonFiltersSupported: boolean | undefined;
  keyPathString: string | number;
  label: string | number;
  model: JSONLogsScene;
  value: string;
}

export function JSONLeafNodeLabelButtons({
  label,
  value,
  fullKeyPath,
  fullKey,
  addJsonFilter,
  existingFilter,
  model,
}: Props) {
  return (
    <>
      <JSONFieldValueButton
        label={label}
        value={value}
        keyPath={fullKeyPath}
        fullKey={fullKey}
        addJsonFilter={addJsonFilter}
        existingFilter={existingFilter}
        type={'include'}
        model={model}
      />
      <JSONFieldValueButton
        label={label}
        value={value}
        keyPath={fullKeyPath}
        fullKey={fullKey}
        addJsonFilter={addJsonFilter}
        existingFilter={existingFilter}
        type={'exclude'}
        model={model}
      />
    </>
  );
}
