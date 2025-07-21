import React from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';

import { JSONLogsScene } from '../JSONLogsScene';
import { JSONFieldValueButton } from './JSONFilterButtons';
import { KeyPath } from '@gtk-grafana/react-json-tree';

interface Props {
  elements: Array<string | React.JSX.Element>;
  existingFilter?: AdHocFilterWithLabels;
  fullKey: string;
  fullKeyPath: KeyPath;
  JSONFiltersSupported: boolean | undefined;
  keyPathString: string | number;
  label: string | number;
  model: JSONLogsScene;
  value: string;
}

export function JSONLeafNodeLabelButtons({ label, value, fullKeyPath, fullKey, existingFilter, model }: Props) {
  return (
    <>
      <JSONFieldValueButton
        label={label}
        value={value}
        keyPath={fullKeyPath}
        fullKey={fullKey}
        existingFilter={existingFilter}
        type={'include'}
        model={model}
      />
      <JSONFieldValueButton
        label={label}
        value={value}
        keyPath={fullKeyPath}
        fullKey={fullKey}
        existingFilter={existingFilter}
        type={'exclude'}
        model={model}
      />
    </>
  );
}
