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
}

const JSONFilterNestedNodeOutButton = memo(({ addFilter, keyPath, jsonKey, active }: Props) => {
  return (
    <IconButton
      tooltip={`Exclude log lines that contain ${keyPath[0]}`}
      onClick={(e) => {
        e.stopPropagation();
        addFilter(keyPath, jsonKey, EMPTY_VARIABLE_VALUE, active ? 'toggle' : 'include');
      }}
      aria-selected={active}
      variant={active ? 'primary' : 'secondary'}
      size={'md'}
      name={'search-minus'}
      aria-label={'remove filter'}
    />
  );
});

JSONFilterNestedNodeOutButton.displayName = 'JSONFilterNestedNodeOutButton';
export default JSONFilterNestedNodeOutButton;
