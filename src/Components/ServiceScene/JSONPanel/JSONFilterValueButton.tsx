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
  type: 'include' | 'exclude';
}
const JSONFilterValueButton = memo(({ label, value, fullKey, fullKeyPath, existingFilter, addFilter, type }: Props) => {
  const operator = type === 'include' ? FilterOp.Equal : FilterOp.NotEqual;
  return (
    <IconButton
      tooltip={`${type === 'include' ? 'Include' : 'Exclude'} log lines containing ${label}="${value}"`}
      onClick={(e) => {
        e.stopPropagation();
        addFilter(fullKeyPath, fullKey, value, existingFilter?.operator === operator ? 'toggle' : type);
      }}
      aria-selected={existingFilter?.operator === operator}
      variant={existingFilter?.operator === operator ? 'primary' : 'secondary'}
      size={'md'}
      name={type === 'include' ? 'search-plus' : 'search-minus'}
      aria-label={`${type} filter`}
    />
  );
});

JSONFilterValueButton.displayName = 'JSONFilterValueButton';
export default JSONFilterValueButton;
