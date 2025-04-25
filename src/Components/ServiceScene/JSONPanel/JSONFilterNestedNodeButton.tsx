import React, { memo } from 'react';

import { IconButton } from '@grafana/ui';

import { EMPTY_VARIABLE_VALUE } from '../../../services/variables';
import { AddJSONFilter } from '../LogsJsonScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';

interface Props {
  active: boolean;
  addFilter: AddJSONFilter;
  jsonKey: string;
  keyPath: KeyPath;
  type: 'exclude' | 'include';
}

const JSONFilterNestedNodeButton = memo(({ active, addFilter, jsonKey, keyPath, type }: Props) => {
  return (
    <IconButton
      tooltip={`${type === 'include' ? 'Include' : 'Exclude'} log lines that contain ${keyPath[0]}`}
      onClick={(e) => {
        e.stopPropagation();
        addFilter(
          keyPath,
          jsonKey,
          EMPTY_VARIABLE_VALUE,
          active ? 'toggle' : type === 'include' ? 'exclude' : 'include'
        );
      }}
      aria-selected={active}
      variant={active ? 'primary' : 'secondary'}
      size={'md'}
      name={type === 'include' ? 'search-plus' : 'search-minus'}
      aria-label={`${type} filter`}
    />
  );
});

JSONFilterNestedNodeButton.displayName = 'JSONFilterNestedNodeButton';
export default JSONFilterNestedNodeButton;
