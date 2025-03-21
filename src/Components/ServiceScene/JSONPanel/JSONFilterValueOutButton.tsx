import { FilterOp } from '../../../services/filterTypes';
import { IconButton } from '@grafana/ui';
import React, { memo } from 'react';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { AdHocFilterWithLabels } from '@grafana/scenes';
import { AddJSONFilter } from '../LogsJsonScene';

interface Props {
  label: string | number;
  value: string;
  fullKeyPath: KeyPath;
  fullKey: string;
  existingFilter?: AdHocFilterWithLabels;
  addFilter: AddJSONFilter;
}

const JSONFilterValueOutButton = memo(({ label, value, fullKey, fullKeyPath, existingFilter, addFilter }: Props) => {
  return (
    <IconButton
      tooltip={`Exclude log lines containing ${label}="${value}"`}
      onClick={(e) => {
        e.stopPropagation();
        addFilter(fullKeyPath, fullKey, value, existingFilter?.operator === FilterOp.NotEqual ? 'toggle' : 'exclude');
      }}
      aria-selected={existingFilter?.operator === FilterOp.Equal}
      variant={existingFilter?.operator === FilterOp.NotEqual ? 'primary' : 'secondary'}
      size={'md'}
      name={'search-minus'}
      aria-label={'remove filter'}
    />
  );
});

JSONFilterValueOutButton.displayName = 'JSONFilterValueOutButton';
export default JSONFilterValueOutButton;
