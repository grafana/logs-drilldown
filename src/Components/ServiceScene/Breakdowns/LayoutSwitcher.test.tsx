import React from 'react';

import { SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { LayoutSwitcher, LayoutType, LayoutTypeEnum } from './LayoutSwitcher';
import { getSceneLayout, setSceneLayout } from 'services/store';

jest.mock('services/store', () => ({
  getSceneLayout: jest.fn(),
  setSceneLayout: jest.fn(),
}));

class MockSceneObject extends SceneObjectBase<SceneObjectState> {
  public static Component = () => <div>Mock Layout</div>;
}

describe('LayoutSwitcher', () => {
  let layoutSwitcher: LayoutSwitcher;
  const mockLayouts: SceneObject[] = [new MockSceneObject({}), new MockSceneObject({}), new MockSceneObject({})];

  const mockOptions = [
    { label: 'Grid', value: LayoutTypeEnum.grid },
    { label: 'Rows', value: LayoutTypeEnum.rows },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    layoutSwitcher = new LayoutSwitcher({
      active: 'grid',
      layouts: mockLayouts,
      options: mockOptions,
    });
  });

  describe('updateLayout', () => {
    test('should set stored layout when it is not single', () => {
      (getSceneLayout as jest.Mock).mockReturnValue(LayoutTypeEnum.grid);

      layoutSwitcher.updateLayout();

      expect(layoutSwitcher.state.active).toBe('grid');
    });
  });

  describe('onLayoutChange', () => {
    test('should update layout and state when changing layout', () => {
      const newLayout: LayoutType = 'rows';

      layoutSwitcher.onLayoutChange(newLayout);

      expect(setSceneLayout).toHaveBeenCalledWith(newLayout);
      expect(layoutSwitcher.state.active).toBe(newLayout);
    });
  });

  describe('onActivate', () => {
    test('should call updateLayout on activation', () => {
      const updateLayoutSpy = jest.spyOn(layoutSwitcher, 'updateLayout');

      layoutSwitcher.onActivate();

      expect(updateLayoutSpy).toHaveBeenCalled();
    });
  });
});
