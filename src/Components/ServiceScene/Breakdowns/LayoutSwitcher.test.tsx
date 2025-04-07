import React from 'react';
import { SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { LayoutSwitcher, LayoutType, LayoutTypeEnum } from './LayoutSwitcher';
import { setSceneLayout, getSceneLayout } from 'services/store';

jest.mock('services/store', () => ({
  setSceneLayout: jest.fn(),
  getSceneLayout: jest.fn(),
}));

class MockSceneObject extends SceneObjectBase<SceneObjectState> {
  public static Component = () => <div>Mock Layout</div>;
}

describe('LayoutSwitcher', () => {
  let layoutSwitcher: LayoutSwitcher;
  const mockLayouts: SceneObject[] = [new MockSceneObject({}), new MockSceneObject({}), new MockSceneObject({})];

  const mockOptions = [
    { label: 'Single', value: LayoutTypeEnum.single },
    { label: 'Grid', value: LayoutTypeEnum.grid },
    { label: 'Rows', value: LayoutTypeEnum.rows },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    layoutSwitcher = new LayoutSwitcher({
      layouts: mockLayouts,
      options: mockOptions,
      active: 'grid',
    });
  });

  describe('isTopLevelLayoutType', () => {
    test('should return true when single layout is not available', () => {
      const topLevelOptions = [
        { label: 'Grid', value: LayoutTypeEnum.grid },
        { label: 'Rows', value: LayoutTypeEnum.rows },
      ];
      layoutSwitcher.setState({ options: topLevelOptions });
      expect(layoutSwitcher.isTopLevelLayoutType()).toBe(true);
    });

    test('should return false when single layout is available', () => {
      expect(layoutSwitcher.isTopLevelLayoutType()).toBe(false);
    });
  });

  describe('updateLayout', () => {
    test('should set grid layout when stored layout is single and it is top level', () => {
      (getSceneLayout as jest.Mock).mockReturnValue(LayoutTypeEnum.single);
      layoutSwitcher.setState({ options: mockOptions.filter((o) => o.value !== LayoutTypeEnum.single) });

      layoutSwitcher.updateLayout();

      expect(layoutSwitcher.state.active).toBe('grid');
    });

    test('should set stored layout when it is not single', () => {
      (getSceneLayout as jest.Mock).mockReturnValue(LayoutTypeEnum.grid);

      layoutSwitcher.updateLayout();

      expect(layoutSwitcher.state.active).toBe('grid');
    });

    test('should set stored layout when single is available', () => {
      (getSceneLayout as jest.Mock).mockReturnValue(LayoutTypeEnum.single);

      layoutSwitcher.updateLayout();

      expect(layoutSwitcher.state.active).toBe('single');
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
