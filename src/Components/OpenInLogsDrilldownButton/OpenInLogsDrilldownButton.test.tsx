import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { AbstractLabelOperator } from '@grafana/data';
import { useReturnToPrevious } from '@grafana/runtime';

import OpenInLogsDrilldownButton from './OpenInLogsDrilldownButton';
import { OpenInLogsDrilldownButtonProps } from './types';
import { addCustomInputPrefixAndValueLabels, encodeFilter } from 'services/extensions/utils';

jest.mock('@grafana/runtime', () => ({
  locationService: {
    getLocation: jest.fn(),
  },
  useReturnToPrevious: jest.fn(),
}));

describe('OpenInLogsDrilldownButton', () => {
  const setReturnToPreviousMock = jest.fn();

  beforeEach(() => {
    (useReturnToPrevious as jest.Mock).mockReturnValue(setReturnToPreviousMock);
  });

  it('should render the button with correct href (Equal operator)', () => {
    const props: OpenInLogsDrilldownButtonProps = {
      datasourceUid: 'test-datasource',
      from: 'now-1h',
      streamSelectors: [{ name: 'job', operator: AbstractLabelOperator.Equal, value: 'test-job' }],
      to: 'now',
    };

    render(<OpenInLogsDrilldownButton {...props} />);

    const linkButton = screen.getByRole('link', { name: /open in logs drilldown/i });
    expect(linkButton).toBeInTheDocument();
    expect(linkButton).toHaveAttribute(
      'href',
      `/a/grafana-lokiexplore-app/explore/job/test-job/logs?var-ds=test-datasource&from=now-1h&to=now&var-filters=${encodeFilter(
        `job|=|${addCustomInputPrefixAndValueLabels('test-job')}`
      )}`
    );
  });

  it('should handle NotEqual operator correctly', () => {
    const props: OpenInLogsDrilldownButtonProps = {
      streamSelectors: [
        { name: 'job', operator: AbstractLabelOperator.Equal, value: 'test-job' },
        { name: 'test_label_key', operator: AbstractLabelOperator.NotEqual, value: 'test-label-value' },
      ],
    };

    render(<OpenInLogsDrilldownButton {...props} />);

    const linkButton = screen.getByRole('link');
    expect(linkButton).toHaveAttribute(
      'href',
      `/a/grafana-lokiexplore-app/explore/job/test-job/logs?var-filters=${encodeFilter(
        `job|=|${addCustomInputPrefixAndValueLabels('test-job')}`
      )}&var-filters=${encodeFilter(`test_label_key|!=|${addCustomInputPrefixAndValueLabels('test-label-value')}`)}`
    );
  });

  it('should handle EqualRegEx operator with properly encoded PromQL values', () => {
    const props: OpenInLogsDrilldownButtonProps = {
      streamSelectors: [
        { name: 'job', operator: AbstractLabelOperator.Equal, value: 'test-job' },
        { name: 'test_label_key', operator: AbstractLabelOperator.EqualRegEx, value: 'special.(char)+|value$' },
      ],
    };

    render(<OpenInLogsDrilldownButton {...props} />);

    const linkButton = screen.getByRole('link');
    expect(linkButton).toHaveAttribute(
      'href',
      `/a/grafana-lokiexplore-app/explore/job/test-job/logs?var-filters=${encodeFilter(
        `job|=|${addCustomInputPrefixAndValueLabels('test-job')}`
      )}&var-filters=${encodeFilter(
        `test_label_key|=~|${addCustomInputPrefixAndValueLabels('special.(char)+|value$')}`
      )}`
    );
  });

  it('should handle NotEqualRegEx operator with properly encoded PromQL values', () => {
    const props: OpenInLogsDrilldownButtonProps = {
      streamSelectors: [
        { name: 'job', operator: AbstractLabelOperator.Equal, value: 'test-job' },
        { name: 'test_label_key', operator: AbstractLabelOperator.NotEqualRegEx, value: 'special.(char)+|value$' },
      ],
    };

    render(<OpenInLogsDrilldownButton {...props} />);

    const linkButton = screen.getByRole('link');
    expect(linkButton).toHaveAttribute(
      'href',
      `/a/grafana-lokiexplore-app/explore/job/test-job/logs?var-filters=${encodeFilter(
        `job|=|${addCustomInputPrefixAndValueLabels('test-job')}`
      )}&var-filters=${encodeFilter(
        `test_label_key|!~|${addCustomInputPrefixAndValueLabels('special.(char)+|value$')}`
      )}`
    );
  });

  it('should not render button if labelMatchers is empty', () => {
    render(<OpenInLogsDrilldownButton streamSelectors={[]} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should call setReturnToPrevious on click', () => {
    const props: OpenInLogsDrilldownButtonProps = {
      returnToPreviousSource: 'test-source',
      streamSelectors: [{ name: 'job', operator: AbstractLabelOperator.Equal, value: 'test-job' }],
    };

    render(<OpenInLogsDrilldownButton {...props} />);

    const linkButton = screen.getByRole('link');
    fireEvent.click(linkButton);

    expect(setReturnToPreviousMock).toHaveBeenCalledWith('test-source');
  });

  it('should render using custom renderButton prop', () => {
    const renderButtonMock = jest.fn(({ href }) => <a href={href}>Custom Button</a>);

    const props: OpenInLogsDrilldownButtonProps = {
      renderButton: renderButtonMock,
      streamSelectors: [{ name: 'job', operator: AbstractLabelOperator.Equal, value: 'test-job' }],
    };

    render(<OpenInLogsDrilldownButton {...props} />);
    expect(screen.getByText('Custom Button')).toBeInTheDocument();
    expect(renderButtonMock).toHaveBeenCalledWith(expect.objectContaining({ href: expect.any(String) }));
  });
});
