import { sceneGraph } from '@grafana/scenes';

import { IndexScene } from '../IndexScene/IndexScene';
import { getMaxLinesOptions, LineLimitScene } from './LineLimitScene';
import { runSceneQueries } from 'services/query';
import { setMaxLines } from 'services/store';

jest.mock('services/store', () => ({
  getMaxLines: jest.fn(() => 1000),
  setMaxLines: jest.fn(),
}));

jest.mock('services/query', () => ({
  runSceneQueries: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: {
    getAncestor: jest.fn(),
  },
}));

describe('LineLimitScene', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(sceneGraph.getAncestor).mockReturnValue({
      state: { ds: { maxLines: 5000 }, lokiConfig: undefined },
    } as IndexScene);
  });

  it('getMaxLinesOptions includes custom values above presets', () => {
    const options = getMaxLinesOptions(6000);

    expect(options.find((o) => o.value === 6000)).toBeDefined();
  });

  it('shows over-limit value as invalid without persisting or querying', () => {
    const scene = new LineLimitScene({});

    scene.onChangeMaxLines({ value: 6000, label: '6000' });

    expect(setMaxLines).not.toHaveBeenCalled();
    expect(runSceneQueries).not.toHaveBeenCalled();
    expect(scene.state.isInvalid).toBe(true);
    expect(scene.state.maxLines).toBe(6000);
  });

  it('persists and queries when value is within the limit', () => {
    const scene = new LineLimitScene({});

    scene.onChangeMaxLines({ value: 2000, label: '2000' });

    expect(setMaxLines).toHaveBeenCalledWith(scene, 2000);
    expect(runSceneQueries).toHaveBeenCalledWith(scene);
    expect(scene.state.isInvalid).toBe(false);
    expect(scene.state.maxLines).toBe(2000);
  });

  it('does not persist invalid non-integer values', () => {
    const scene = new LineLimitScene({ maxLines: 1000 });

    scene.onChangeMaxLines({ value: 'abc' as unknown as number, label: 'abc' });

    expect(setMaxLines).not.toHaveBeenCalled();
    expect(runSceneQueries).not.toHaveBeenCalled();
    expect(scene.state.isInvalid).toBe(true);
    expect(scene.state.maxLines).toBe(1000);
  });
});
