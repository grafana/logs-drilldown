import { IconButton } from '@grafana/ui';
import React from 'react';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { AddJSONFilter } from '../LogsJsonScene';
import { EMPTY_VARIABLE_VALUE } from '../../../services/variables';

interface Props {
  jsonKey: string;
  keyPath: KeyPath;
  addFilter: AddJSONFilter;
  active: boolean;
}

export function JSONFilterNestedNodeInButton({ addFilter, keyPath, jsonKey, active }: Props) {
  return (
    <IconButton
      tooltip={`Include log lines that contain ${keyPath[0]}`}
      onClick={(e) => {
        e.stopPropagation();
        addFilter(keyPath, jsonKey, EMPTY_VARIABLE_VALUE, active ? 'toggle' : 'exclude');
      }}
      variant={active ? 'primary' : 'secondary'}
      size={'md'}
      name={'search-plus'}
      aria-label={'add filter'}
    />
  );
}
