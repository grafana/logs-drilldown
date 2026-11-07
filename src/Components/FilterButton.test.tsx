import React from 'react';

import { render, screen } from '@testing-library/react';

import { FilterButton } from './FilterButton';

const renderFilterButton = (state: { isExcluded: boolean; isIncluded: boolean }) =>
  render(
    <FilterButton buttonFill="outline" onClear={jest.fn()} onExclude={jest.fn()} onInclude={jest.fn()} {...state} />
  );

describe('FilterButton', () => {
  it.each([
    { isExcluded: false, isIncluded: false },
    { isExcluded: false, isIncluded: true },
    { isExcluded: true, isIncluded: false },
  ])('exposes each filter as a toggle button: %o', ({ isExcluded, isIncluded }) => {
    renderFilterButton({ isExcluded, isIncluded });

    const include = screen.getByRole('button', { name: 'Include', pressed: isIncluded });
    const exclude = screen.getByRole('button', { name: 'Exclude', pressed: isExcluded });

    expect(include).not.toHaveAttribute('aria-selected');
    expect(exclude).not.toHaveAttribute('aria-selected');
  });
});
