import React from 'react';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LogsSortOrder } from '@grafana/data';
import { sceneGraph } from '@grafana/scenes';

import { LogsListScene } from './LogsListScene';
import { getLogOption, setLogOption } from 'services/store';

jest.mock('services/store');
jest.mock('./LogsListScene');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    buildInfo: {
      ...jest.requireActual('@grafana/runtime').config.buildInfo,
      version: '11.6',
    },
  },
}));

describe('LogOptionsScene', () => {
  beforeEach(() => {
    jest.mocked(setLogOption).mockClear();
  });

  test('Reads active state and stores changes (sortOrder - default)', async () => {
    jest.mocked(getLogOption).mockReturnValueOnce(LogsSortOrder.Descending);
    const scene = new LogsListScene({});
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(scene);

    render(<scene.Component model={scene} />);

    expect(screen.getByTitle('Show results newest to oldest')).toBeInTheDocument();
    expect(screen.getByTitle('Show results oldest to newest')).toBeInTheDocument();
    await act(async () => userEvent.click(screen.getByTitle('Show results oldest to newest')));
    expect(setLogOption).toHaveBeenCalledTimes(1);
    expect(setLogOption).toHaveBeenCalledWith('sortOrder', LogsSortOrder.Ascending);
    expect(scene.setLogsVizOption).toHaveBeenCalledWith({ sortOrder: LogsSortOrder.Ascending });
  });

  test('Reads active state and stores changes (sortOrder - Descending)', async () => {
    jest.mocked(getLogOption).mockReturnValueOnce(LogsSortOrder.Ascending);
    const scene = new LogsListScene({});
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(scene);

    render(<scene.Component model={scene} />);

    expect(screen.getByTitle('Show results newest to oldest')).toBeInTheDocument();
    expect(screen.getByTitle('Show results oldest to newest')).toBeInTheDocument();
    await act(async () => userEvent.click(screen.getByTitle('Show results newest to oldest')));
    expect(setLogOption).toHaveBeenCalledTimes(1);
    expect(setLogOption).toHaveBeenCalledWith('sortOrder', LogsSortOrder.Descending);
    expect(scene.setLogsVizOption).toHaveBeenCalledWith({ sortOrder: LogsSortOrder.Descending });
  });

  test('Reads active state and stores changes (wrapLogMessage)', async () => {
    jest.mocked(getLogOption).mockReturnValueOnce('true');
    const scene = new LogsListScene({});
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(scene);

    render(<scene.Component model={scene} />);

    expect(screen.getByTitle('Enable wrapping of long log lines')).toBeInTheDocument();
    expect(screen.getByTitle('Disable wrapping of long log lines')).toBeInTheDocument();
    await act(async () => userEvent.click(screen.getByTitle('Enable wrapping of long log lines')));
    expect(setLogOption).toHaveBeenCalledTimes(2);
    expect(setLogOption).toHaveBeenCalledWith('wrapLogMessage', true);
    expect(setLogOption).toHaveBeenCalledWith('prettifyLogMessage', true);
    expect(scene.setLogsVizOption).toHaveBeenCalledWith({ prettifyLogMessage: true, wrapLogMessage: true });
  });

  test('Does not show the clear fields button with no fields in display', async () => {
    jest.mocked(getLogOption).mockReturnValueOnce('true');
    const scene = new LogsListScene({});
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(scene);

    render(<scene.Component model={scene} />);

    expect(screen.queryByText('Show original log line')).not.toBeInTheDocument();
  });

  test('Shows the clear fields button with fields in display', async () => {
    jest.mocked(getLogOption).mockReturnValueOnce('true');
    const scene = new LogsListScene({ displayedFields: ['yass'] });
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(scene);

    render(<scene.Component model={scene} />);

    expect(screen.getByText('Show original log line')).toBeInTheDocument();

    await act(async () => userEvent.click(screen.getByText('Show original log line')));

    expect(scene.clearDisplayedFields).toHaveBeenCalledTimes(1);
  });
});
