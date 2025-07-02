import React, { memo } from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';
import { IconButton } from '@grafana/ui';

import { FilterOp } from '../../../services/filterTypes';
import { InterpolatedFilterType } from '../Breakdowns/AddToFiltersButton';
import { AddJSONFilter, AddMetadataFilter } from '../LogsJsonScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';

interface JsonFilterProps {
  addFilter: AddJSONFilter;
  existingFilter?: AdHocFilterWithLabels;
  fullKey: string;
  fullKeyPath: KeyPath;
  label: string | number;
  type: 'exclude' | 'include';
  value: string;
}

interface MetadataFilterProps {
  addFilter: AddMetadataFilter;
  existingFilter?: AdHocFilterWithLabels;
  label: string;
  type: 'exclude' | 'include';
  value: string;
  variableType: InterpolatedFilterType;
}
export const JSONFilterValueButton = memo(
  ({ addFilter, existingFilter, fullKey, fullKeyPath, label, type, value }: JsonFilterProps) => {
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
  }
);
JSONFilterValueButton.displayName = 'JSONFilterValueButton';

export const FilterValueButton = memo(
  ({ addFilter, existingFilter, label, type, value, variableType }: MetadataFilterProps) => {
    const operator = type === 'include' ? FilterOp.Equal : FilterOp.NotEqual;
    return (
      <IconButton
        tooltip={`${type === 'include' ? 'Include' : 'Exclude'} log lines containing ${label}="${value}"`}
        onClick={(e) => {
          e.stopPropagation();
          addFilter(label, value, existingFilter?.operator === operator ? 'toggle' : type, variableType);
        }}
        aria-selected={existingFilter?.operator === operator}
        variant={existingFilter?.operator === operator ? 'primary' : 'secondary'}
        size={'md'}
        name={type === 'include' ? 'search-plus' : 'search-minus'}
        aria-label={`${type} filter`}
      />
    );
  }
);
FilterValueButton.displayName = 'FilterValueButton';
