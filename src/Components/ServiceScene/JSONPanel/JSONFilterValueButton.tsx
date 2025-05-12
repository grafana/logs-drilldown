import React, { memo } from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';
import { IconButton } from '@grafana/ui';

import { FilterOp } from '../../../services/filterTypes';
import { AddJSONFilter } from '../LogsJsonScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';

interface Props {
  addFilter: AddJSONFilter;
  existingFilter?: AdHocFilterWithLabels;
  fullKey: string;
  fullKeyPath: KeyPath;
  label: string | number;
  type: 'exclude' | 'include';
  value: string;
}
const JSONFilterValueButton = memo(({ addFilter, existingFilter, fullKey, fullKeyPath, label, type, value }: Props) => {
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
