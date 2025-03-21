import { IconButton } from '@grafana/ui';
import { FilterOp } from '../../../services/filterTypes';
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
const JSONFilterValueInButton = memo(({ label, value, fullKey, fullKeyPath, existingFilter, addFilter }: Props) => {
  return (
    <IconButton
      tooltip={`Include log lines containing ${label}="${value}"`}
      onClick={(e) => {
        e.stopPropagation();
        addFilter(fullKeyPath, fullKey, value, existingFilter?.operator === FilterOp.Equal ? 'toggle' : 'include');
      }}
      aria-selected={existingFilter?.operator === FilterOp.Equal}
      variant={existingFilter?.operator === FilterOp.Equal ? 'primary' : 'secondary'}
      size={'md'}
      name={'search-plus'}
      aria-label={'add filter'}
    />
  );
});

JSONFilterValueInButton.displayName = 'JSONFilterValueInButton';
export default JSONFilterValueInButton;
