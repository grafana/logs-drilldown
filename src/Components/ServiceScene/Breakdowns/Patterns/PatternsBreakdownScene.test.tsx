import React from 'react';

import { render, screen } from '@testing-library/react';

import { dateTime } from '@grafana/data';
import { sceneGraph } from '@grafana/scenes';

import { PATTERNS_MAX_AGE_HOURS, PatternsBreakdownScene } from './PatternsBreakdownScene';

const mockGetTimeRange = jest.spyOn(sceneGraph, 'getTimeRange');
const mockGetAncestor = jest.spyOn(sceneGraph, 'getAncestor');

function createTimeRangeMock(to: ReturnType<typeof dateTime>) {
  return {
    useState: () => ({ value: { to } }),
    subscribeToState: jest.fn().mockReturnValue(jest.fn()),
  } as never;
}

describe('PatternsBreakdownScene', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTimeRange.mockReturnValue(createTimeRangeMock(dateTime()));
    mockGetAncestor.mockReturnValue({
      state: { $patternsData: undefined },
      subscribeToState: jest.fn().mockReturnValue(jest.fn()),
    } as never);
  });

  describe('Component', () => {
    it('renders error message when error is true and not loading', () => {
      mockGetTimeRange.mockReturnValue(createTimeRangeMock(dateTime()));

      const scene = new PatternsBreakdownScene({ error: true, loading: false });
      render(<scene.Component model={scene} />);

      expect(screen.getByText('There are no pattern matches.')).toBeInTheDocument();
      expect(screen.getByText(/Pattern matching has not been configured/)).toBeInTheDocument();
      expect(screen.getByText(/--pattern-ingester.enabled=true/)).toBeInTheDocument();
    });

    it('renders PatternsTooOld when no patterns, not loading, not error, and time range is too old', () => {
      mockGetTimeRange.mockReturnValue(createTimeRangeMock(dateTime().subtract(PATTERNS_MAX_AGE_HOURS, 'hours')));

      const scene = new PatternsBreakdownScene({
        error: false,
        loading: false,
        patternFrames: [],
      });
      render(<scene.Component model={scene} />);

      expect(
        screen.getByText(
          new RegExp(`Patterns are only available for the most recent ${PATTERNS_MAX_AGE_HOURS} hours of data`)
        )
      ).toBeInTheDocument();
    });

    it('renders PatternsNotDetected when no patterns, not loading, not error, and time range is recent', () => {
      mockGetTimeRange.mockReturnValue(createTimeRangeMock(dateTime()));

      const scene = new PatternsBreakdownScene({
        error: false,
        loading: false,
        patternFrames: [],
      });
      render(<scene.Component model={scene} />);

      expect(screen.getByText(/Sorry, we could not detect any patterns/)).toBeInTheDocument();
    });

    it('renders no-match empty state when patternFrames is undefined', () => {
      mockGetTimeRange.mockReturnValue(createTimeRangeMock(dateTime()));

      const scene = new PatternsBreakdownScene({
        error: false,
        loading: false,
        patternFrames: undefined,
      });
      render(<scene.Component model={scene} />);

      expect(screen.getByText('No patterns match these filters.')).toBeInTheDocument();
    });
  });

  describe('constructor', () => {
    it('initializes with loading true and patternFilter empty by default', () => {
      const scene = new PatternsBreakdownScene({});

      expect(scene.state.loading).toBe(true);
      expect(scene.state.patternFilter).toBe('');
    });

    it('merges provided state with defaults', () => {
      const scene = new PatternsBreakdownScene({ patternFilter: 'foo', loading: false });

      expect(scene.state.patternFilter).toBe('foo');
      expect(scene.state.loading).toBe(false);
    });
  });
});
