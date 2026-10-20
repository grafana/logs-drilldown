import React from 'react';

import { act, render, screen } from '@testing-library/react';

import { dateTime, LoadingState, PanelData } from '@grafana/data';
import { SceneDataNode, SceneFlexItem, sceneGraph } from '@grafana/scenes';

import { LogsQueryFooter } from './LogsQueryFooter';
import { IndexScene } from 'Components/IndexScene/IndexScene';

const timeRange = {
  from: dateTime('2026-01-01T00:00:00Z'),
  raw: { from: 'now-1h', to: 'now' },
  to: dateTime('2026-01-01T01:00:00Z'),
};

function renderFooter(data?: PanelData) {
  const dataNode = new SceneDataNode({ data });
  const footer = new LogsQueryFooter();
  new SceneFlexItem({
    $data: dataNode,
    body: footer,
  });
  footer.activate();
  return { dataNode, ...render(<footer.Component model={footer} />) };
}

const doneData: PanelData = {
  series: [
    {
      fields: [],
      length: 0,
      meta: {
        stats: [{ displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 }],
      },
      refId: 'logsPanelQuery',
    },
  ],
  state: LoadingState.Done,
  timeRange,
};

describe('LogsQueryFooter', () => {
  beforeEach(() => {
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      useState: () => ({ embedded: false }),
    } as unknown as IndexScene);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows total bytes processed from the query runner stats', () => {
    renderFooter({
      series: [
        {
          fields: [],
          length: 0,
          meta: {
            stats: [{ displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 }],
          },
          refId: 'logsPanelQuery',
        },
      ],
      state: LoadingState.Done,
      timeRange,
    });

    expect(screen.getByText(/Total bytes processed/)).toHaveTextContent('11 B');
    expect(screen.queryByText('Maximum of series (500) reached for a single query.')).not.toBeInTheDocument();
  });

  it('shows notices from the query response', () => {
    renderFooter({
      series: [
        {
          fields: [],
          length: 0,
          meta: {
            notices: [{ severity: 'warning', text: 'Maximum of series (500) reached for a single query.' }],
          },
          refId: 'logsPanelQuery',
        },
      ],
      state: LoadingState.Done,
      timeRange,
    });

    expect(screen.getByText('Maximum of series (500) reached for a single query.')).toBeInTheDocument();
  });

  it('says no data when the query runner has no data', () => {
    renderFooter(undefined);

    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('says loading while the query is loading', () => {
    renderFooter({
      series: [],
      state: LoadingState.Loading,
      timeRange,
    });

    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('updates when the query runner state changes', () => {
    const { dataNode } = renderFooter(undefined);

    expect(screen.getByText('No data')).toBeInTheDocument();

    act(() => {
      dataNode.setState({
        data: {
          series: [],
          state: LoadingState.Loading,
          timeRange,
        },
      });
    });

    expect(screen.getByText('Loading')).toBeInTheDocument();

    act(() => {
      dataNode.setState({
        data: {
          series: [
            {
              fields: [],
              length: 0,
              meta: {
                notices: [{ severity: 'warning', text: 'Query completed with warnings.' }],
                stats: [{ displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 22 }],
              },
              refId: 'logsPanelQuery',
            },
          ],
          state: LoadingState.Done,
          timeRange,
        },
      });
    });

    expect(screen.getByText(/Total bytes processed/)).toHaveTextContent('22 B');
    expect(screen.getByText('Query completed with warnings.')).toBeInTheDocument();
  });

  it('says error when the query fails', () => {
    renderFooter({
      series: [],
      state: LoadingState.Error,
      timeRange,
    });

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('disables view details when the index scene is embedded', () => {
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      useState: () => ({ embedded: true }),
    } as unknown as IndexScene);

    renderFooter(doneData);

    expect(screen.getByRole('button', { name: 'View details' })).toBeDisabled();
  });

  it('says streaming while the query is streaming', () => {
    renderFooter({
      series: [],
      state: LoadingState.Streaming,
      timeRange,
    });

    expect(screen.getByText('Streaming')).toBeInTheDocument();
  });
});
