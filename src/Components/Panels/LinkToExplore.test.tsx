import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { LinkToExplore } from './LinkToExplore';
import { getExploreLink } from './PanelMenu';
import { testIds } from 'services/testIds';

jest.mock('services/analytics');
jest.mock('./PanelMenu', () => ({
  getExploreLink: jest.fn(),
}));

describe('LinkToExplore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getExploreLink).mockReturnValue('/explore?test=true');
  });

  it('renders Explore header button with generated href', () => {
    const model = new LinkToExplore({});
    render(<LinkToExplore.Component model={model} />);

    const button = screen.getByTestId(testIds.exploreServiceDetails.openExplore);
    expect(button).toBeVisible();
    expect(button).toHaveAttribute('href', '/explore?test=true');
  });

  it('tracks analytics when Explore button is clicked', async () => {
    const user = userEvent.setup();
    const model = new LinkToExplore({});
    render(<LinkToExplore.Component model={model} />);

    await user.click(screen.getByTestId(testIds.exploreServiceDetails.openExplore));

    expect(reportAppInteraction).toHaveBeenCalledWith(
      USER_EVENTS_PAGES.all,
      USER_EVENTS_ACTIONS.all.open_in_explore_menu_clicked
    );
  });
});
