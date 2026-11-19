import React from 'react';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { usePluginUserStorage } from '@grafana/runtime';

import { InterceptBanner } from './InterceptBanner';
import { logger } from 'services/logger';
import { testIds } from 'services/testIds';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginUserStorage: jest.fn(),
}));
jest.mock('services/logger', () => ({ logger: { error: jest.fn() } }));

const userStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  deleteItem: jest.fn(),
  allItems: jest.fn(),
};

describe('welcome banner user preference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(usePluginUserStorage).mockReturnValue(userStorage);
    userStorage.getItem.mockResolvedValue(null);
    userStorage.setItem.mockResolvedValue(undefined);
  });

  it('waits for the stored preference before showing the banner', () => {
    userStorage.getItem.mockReturnValue(new Promise(() => {}));
    render(<InterceptBanner />);
    expect(screen.queryByTestId(testIds.index.welcomeBanner)).not.toBeInTheDocument();
  });

  it('shows the banner when the user has not dismissed it', async () => {
    render(<InterceptBanner />);
    expect(await screen.findByTestId(testIds.index.welcomeBanner)).toBeVisible();
    expect(userStorage.getItem).toHaveBeenCalledWith('welcomeBannerDismissed');
  });

  it('keeps the banner hidden for a user with a saved dismissal', async () => {
    userStorage.getItem.mockResolvedValue('true');
    await act(async () => {
      render(<InterceptBanner />);
    });
    expect(screen.queryByTestId(testIds.index.welcomeBanner)).not.toBeInTheDocument();
  });

  it('saves dismissal through user storage and hides the banner', async () => {
    const user = userEvent.setup();
    render(<InterceptBanner />);
    await screen.findByTestId(testIds.index.welcomeBanner);
    await user.click(screen.getByRole('button', { name: 'Close alert' }));
    expect(userStorage.setItem).toHaveBeenCalledWith('welcomeBannerDismissed', 'true');
    await waitFor(() => expect(screen.queryByTestId(testIds.index.welcomeBanner)).not.toBeInTheDocument());
  });

  it('still allows dismissal when reading the saved preference fails', async () => {
    const error = new Error('Read failed');
    userStorage.getItem.mockRejectedValueOnce(error);
    render(<InterceptBanner />);
    expect(await screen.findByTestId(testIds.index.welcomeBanner)).toBeVisible();
    expect(logger.error).toHaveBeenCalledWith(error, expect.any(Object));
  });

  it('keeps the banner available to retry if saving fails', async () => {
    const user = userEvent.setup();
    const error = new Error('Write failed');
    userStorage.setItem.mockRejectedValueOnce(error);
    render(<InterceptBanner />);
    await screen.findByTestId(testIds.index.welcomeBanner);
    await user.click(screen.getByRole('button', { name: 'Close alert' }));
    expect(screen.getByTestId(testIds.index.welcomeBanner)).toBeVisible();
    expect(logger.error).toHaveBeenCalledWith(error, expect.any(Object));
  });
});
