import { IconButton } from '@grafana/ui';
import React, { memo } from 'react';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { AddJSONFilter } from '../LogsJsonScene';
import { EMPTY_VARIABLE_VALUE } from '../../../services/variables';

interface Props {
  jsonKey: string;
  keyPath: KeyPath;
  addFilter: AddJSONFilter;
  active: boolean;
  type: 'include' | 'exclude';
}

const JSONFilterNestedNodeButton = memo(({ addFilter, keyPath, jsonKey, active, type }: Props) => {
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
