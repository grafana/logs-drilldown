import React from 'react';
import { render } from '@testing-library/react';
import { GrotError } from './GrotError';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  useTheme2: jest.fn(() => ({
    isDark: false,
  })),
}));

describe('GrotError', () => {
  it('renders the default error message if no children are provided', () => {
    const { getByText } = render(<GrotError />);

    const message = getByText('An error occurred');

    expect(message).toBeInTheDocument();
  });
});
