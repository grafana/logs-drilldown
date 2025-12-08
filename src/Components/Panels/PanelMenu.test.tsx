import React from 'react';

import { render } from '@testing-library/react';
import { of } from 'rxjs';

import { isAssistantAvailable } from '@grafana/assistant';
import { PanelMenuItem } from '@grafana/data';
import { getDataSourceSrv, usePluginComponent } from '@grafana/runtime';
import {
  SceneCSSGridItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneQueryRunner,
  VizPanel,
  VizPanelMenu,
} from '@grafana/scenes';

import { reportAppInteraction } from '../../services/analytics';
import { interpolateExpression } from '../../services/query';
import { findObjectOfType, getDataSource, getQueryRunnerFromChildren } from '../../services/scenes';
import { setPanelOption } from '../../services/store';
import { IndexScene } from '../IndexScene/IndexScene';
import { FieldsVizPanelWrapper } from '../ServiceScene/Breakdowns/FieldsVizPanelWrapper';
import { setValueSummaryHeight } from '../ServiceScene/Breakdowns/Panels/ValueSummary';
import { onExploreLinkClick } from '../ServiceScene/OnExploreLinkClick';
import {
  CollapsablePanelText,
  getAddToDashboardPayload,
  getExploreLink,
  PanelMenu,
  TimeSeriesPanelType,
  TimeSeriesQueryType,
} from './PanelMenu';

// Mock external dependencies
jest.mock('@grafana/assistant');
jest.mock('@grafana/runtime');
jest.mock('../../services/analytics');
jest.mock('../../services/query');
jest.mock('../../services/scenes', () => ({
  getDataSource: jest.fn(),
  getQueryRunnerFromChildren: jest.fn(),
  findObjectOfType: jest.fn(),
}));
jest.mock('../../services/store');
jest.mock('../ServiceScene/Breakdowns/Panels/ValueSummary');
jest.mock('../ServiceScene/OnExploreLinkClick');

// Type the mocked functions
const mockSceneGraph = {
  getAncestor: jest.fn(),
  getData: jest.fn(),
  getTimeRange: jest.fn(),
  findObject: jest.fn(),
};

const mockVizPanel: VizPanel = {
  state: {
    collapsed: false,
    collapsible: true,
    title: 'Test Panel',
    fieldConfig: { defaults: {}, overrides: [] },
    options: {},
    $data: {
      state: {
        data: {
          request: {
            targets: [{ refId: 'A', legendFormat: 'test' }],
          },
        },
      },
    },
  } as any,
  setState: jest.fn(),
  clone: jest.fn().mockReturnThis(),
} as any;

const mockIndexScene: IndexScene = {
  state: {},
} as any;

const mockQueryRunner: SceneQueryRunner = {
  state: {
    queries: [{ expr: 'test_query' }],
  },
  clone: jest.fn().mockReturnThis(),
} as any;

const mockGridItem = {
  setState: jest.fn(),
};

const mockFieldsVizPanelWrapper = {
  setState: jest.fn(),
  state: {
    viz: mockVizPanel,
  },
};

const mockFlexLayout = {
  state: {},
};

// Setup mocks
beforeEach(() => {
  jest.clearAllMocks();

  // Mock sceneGraph functions
  Object.assign(sceneGraph, mockSceneGraph);

  mockSceneGraph.getAncestor.mockImplementation((ref: SceneObject, type: unknown) => {
    if (type === VizPanel) {
      return mockVizPanel;
    }
    if (type === IndexScene) {
      return mockIndexScene;
    }
    if (type === SceneFlexLayout) {
      return mockFlexLayout;
    }
    if (type === SceneCSSGridItem) {
      return mockGridItem;
    }
    if (type === FieldsVizPanelWrapper) {
      return mockFieldsVizPanelWrapper;
    }
    return null;
  });

  mockSceneGraph.getData.mockReturnValue(mockQueryRunner);
  mockSceneGraph.getTimeRange.mockReturnValue({
    state: { value: { from: 'now-1h', to: 'now' } },
  });

  // Mock service functions
  jest.mocked(getDataSourceSrv).mockReturnValue({
    get: jest.fn().mockResolvedValue({ uid: 'test-datasource-uid' }),
  } as any);

  jest.mocked(getDataSource).mockReturnValue('test-datasource');
  jest.mocked(getQueryRunnerFromChildren).mockReturnValue([mockQueryRunner]);
  jest.mocked(findObjectOfType).mockReturnValue(null);
  jest.mocked(interpolateExpression).mockReturnValue('test_query_expression');
  jest.mocked(onExploreLinkClick).mockReturnValue('test-explore-link');
  jest.mocked(isAssistantAvailable).mockReturnValue(of(false));
  jest.mocked(usePluginComponent).mockReturnValue({ component: null, isLoading: false });
});

describe('PanelMenu', () => {
  describe('Constructor and State', () => {
    it('should initialize with default state', () => {
      const menu = new PanelMenu({});

      expect(menu.state.addInvestigationsLink).toBe(true);
      expect(menu.state.body).toBeUndefined();
      expect(menu.state.panelType).toBeUndefined();
    });

    it('should initialize with custom state', () => {
      const menu = new PanelMenu({
        addInvestigationsLink: false,
        panelType: TimeSeriesPanelType.histogram,
      });

      expect(menu.state.addInvestigationsLink).toBe(false);
      expect(menu.state.panelType).toBe(TimeSeriesPanelType.histogram);
    });
  });

  describe('Menu Activation', () => {
    it('should create basic navigation menu on activation', () => {
      const menu = new PanelMenu({ addInvestigationsLink: false });
      menu.activate();

      expect(menu.state.body).toBeInstanceOf(VizPanelMenu);

      const items = menu.state.body?.state.items;
      expect(items).toContainEqual(
        expect.objectContaining({
          text: 'Navigation',
          type: 'group',
        })
      );
      expect(items).toContainEqual(
        expect.objectContaining({
          text: 'Explore',
          iconClassName: 'compass',
        })
      );
    });

    it('should add visualization options when the viz panel has collapsible state', () => {
      const menu = new PanelMenu({ addInvestigationsLink: false });
      menu.activate();

      const items = menu.state.body?.state.items;
      expect(items).toContainEqual(
        expect.objectContaining({
          text: 'Visualization',
          type: 'group',
        })
      );
      expect(items).toContainEqual(
        expect.objectContaining({
          text: CollapsablePanelText.collapsed,
          iconClassName: 'table-expand-all',
        })
      );
    });

    it('should add histogram toggle when panel type is set', () => {
      const menu = new PanelMenu({
        addInvestigationsLink: false,
        panelType: TimeSeriesPanelType.timeseries,
      });
      const vizPanelWrapper = new FieldsVizPanelWrapper({
        viz: new VizPanel({ menu }),
        queryType: TimeSeriesQueryType.avg,
        supportsHistogram: true,
      });
      jest.mocked(findObjectOfType).mockReturnValue(vizPanelWrapper);
      menu.activate();

      const items = menu.state.body?.state.items;
      expect(items).toContainEqual(
        expect.objectContaining({
          text: 'Histogram',
          iconClassName: 'graph-bar',
        })
      );
    });

    it('should handle VizPanel not found gracefully', () => {
      mockSceneGraph.getAncestor.mockImplementation((ref: SceneObject, type: unknown) => {
        if (type === VizPanel) {
          throw new Error('VizPanel not found');
        }
        return null;
      });

      const menu = new PanelMenu({ addInvestigationsLink: false });

      expect(() => menu.activate()).not.toThrow();
      expect(menu.state.body).toBeInstanceOf(VizPanelMenu);
    });
  });

  describe('Event Handlers', () => {
    it('should track analytics when explore link is clicked', () => {
      const menu = new PanelMenu({ addInvestigationsLink: false });
      menu.activate();

      const items = menu.state.body?.state.items;
      const exploreItem = items?.find((item: PanelMenuItem) => item.text === 'Explore');

      // @ts-expect-error
      exploreItem?.onClick?.();

      expect(reportAppInteraction).toHaveBeenCalled();
    });

    it('should handle collapse/expand toggle correctly', () => {
      const menu = new PanelMenu({ addInvestigationsLink: false });
      menu.activate();

      const items = menu.state.body?.state.items;
      const collapseItem = items?.find((item: PanelMenuItem) => item.text === CollapsablePanelText.collapsed);

      // @ts-expect-error
      collapseItem?.onClick?.();

      expect(mockVizPanel.setState).toHaveBeenCalledWith({ collapsed: true });
      expect(setPanelOption).toHaveBeenCalledWith('collapsed', CollapsablePanelText.collapsed);
      expect(setValueSummaryHeight).toHaveBeenCalled();
    });

    it('should handle visualization type switching', () => {
      const menu = new PanelMenu({
        addInvestigationsLink: false,
        panelType: TimeSeriesPanelType.timeseries,
      });
      const vizPanelWrapper = new FieldsVizPanelWrapper({
        viz: new VizPanel({ menu }),
        queryType: TimeSeriesQueryType.avg,
        supportsHistogram: true,
      });
      jest.mocked(findObjectOfType).mockReturnValue(vizPanelWrapper);
      menu.activate();

      const items = menu.state.body?.state.items;
      const histogramItem = items?.find((item: PanelMenuItem) => item.text === 'Histogram');
      //@ts-expect-error
      jest.mocked(findObjectOfType).mockReturnValue({ rebuildChangedPanels: jest.fn() });

      // @ts-expect-error
      histogramItem?.onClick?.();

      expect(mockGridItem.setState).toHaveBeenCalled();
      expect(setPanelOption).toHaveBeenCalledWith('panelType', TimeSeriesPanelType.histogram);
    });
  });

  describe('VizPanelMenu', () => {
    it('should add items to the VizPanelMenu', () => {
      const menu = new PanelMenu({ addInvestigationsLink: false });
      menu.activate();

      const mockAddItem = menu.state.body
        ? jest.spyOn(menu.state.body, 'addItem').mockImplementation(() => {})
        : jest.fn();
      const testItem: PanelMenuItem = { text: 'Test Item', type: 'group' };

      menu.addItem(testItem);

      expect(mockAddItem).toHaveBeenCalledWith(testItem);
    });

    it('should set items on VizPanelMenu', () => {
      const menu = new PanelMenu({ addInvestigationsLink: false });
      menu.activate();

      const mockSetItems = menu.state.body
        ? jest.spyOn(menu.state.body, 'setItems').mockImplementation(() => {})
        : jest.fn();
      const testItems: PanelMenuItem[] = [{ text: 'Test Item', type: 'group' }];

      menu.setItems(testItems);

      expect(mockSetItems).toHaveBeenCalledWith(testItems);
    });
  });

  describe('Utility Functions', () => {
    it('should generate explore link correctly', () => {
      const menu = new PanelMenu({ addInvestigationsLink: false });
      const link = getExploreLink(menu);

      expect(link).toBe('test-explore-link');
      expect(onExploreLinkClick).toHaveBeenCalledWith(mockIndexScene, 'test_query_expression');
    });

    it('should generate add to dashboard payload correctly', () => {
      const menu = new PanelMenu({
        addInvestigationsLink: false,
        investigationOptions: {
          type: 'logs',
          labelName: 'test-label',
        },
      });

      const payload = getAddToDashboardPayload(menu);

      expect(payload).toEqual({
        panel: expect.objectContaining({
          type: 'logs',
          title: 'test-label',
          datasource: {
            type: 'loki',
            uid: 'test-datasource',
          },
          targets: [{ refId: 'A', expr: 'test_query_expression', legendFormat: 'test' }],
        }),
        timeRange: { from: 'now-1h', to: 'now' },
      });
    });

    it('should handle missing query runner gracefully in explore link', () => {
      mockSceneGraph.getData.mockReturnValue(null);
      mockSceneGraph.findObject.mockReturnValue(null);
      jest.mocked(getQueryRunnerFromChildren).mockReturnValue([]);

      const menu = new PanelMenu({ addInvestigationsLink: false });

      expect(() => getExploreLink(menu)).toThrow();
    });
  });

  describe('Panel Type Behavior', () => {
    it('should show correct icon for timeseries panel', () => {
      const menu = new PanelMenu({
        addInvestigationsLink: false,
        panelType: TimeSeriesPanelType.timeseries,
        fieldType: 'float',
      });
      const vizPanelWrapper = new FieldsVizPanelWrapper({
        viz: new VizPanel({ menu }),
        queryType: TimeSeriesQueryType.avg,
        supportsHistogram: true,
      });

      jest.mocked(findObjectOfType).mockReturnValue(vizPanelWrapper);
      menu.activate();

      const items = menu.state.body?.state.items;
      const histogramItem = items?.find((item: PanelMenuItem) => item.text === 'Histogram');

      expect(histogramItem?.iconClassName).toBe('graph-bar');
    });

    it('should show correct icon for histogram panel', () => {
      const menu = new PanelMenu({
        addInvestigationsLink: false,
        panelType: TimeSeriesPanelType.histogram,
        fieldType: 'float',
      });
      const vizPanelWrapper = new FieldsVizPanelWrapper({
        viz: new VizPanel({ menu }),
        queryType: TimeSeriesQueryType.avg,
        supportsHistogram: true,
      });

      jest.mocked(findObjectOfType).mockReturnValue(vizPanelWrapper);
      menu.activate();

      const items = menu.state.body?.state.items;
      const timeseriesItem = items?.find((item: PanelMenuItem) => item.text === 'Time series');

      expect(timeseriesItem?.iconClassName).toBe('chart-line');
    });

    it('should show plot average option for int fields', () => {
      const menu = new PanelMenu({
        addInvestigationsLink: false,
        panelType: TimeSeriesPanelType.histogram,
        fieldType: 'int',
      });
      const vizPanelWrapper = new FieldsVizPanelWrapper({
        viz: new VizPanel({ menu }),
        queryType: TimeSeriesQueryType.avg,
        supportsHistogram: true,
      });

      jest.mocked(findObjectOfType).mockReturnValue(vizPanelWrapper);
      menu.activate();

      const items = menu.state.body?.state.items;
      const timeseriesItem = items?.find((item: PanelMenuItem) => item.text === 'Plot average');

      expect(timeseriesItem?.iconClassName).toBe('heart-rate');
    });
  });

  describe('Collapsible Panel State', () => {
    it('should show expand icon when panel is collapsed', () => {
      mockVizPanel.state.collapsed = true;

      const menu = new PanelMenu({ addInvestigationsLink: false });
      menu.activate();

      const items = menu.state.body?.state.items;
      const collapseItem = items?.find((item: PanelMenuItem) => item.text === CollapsablePanelText.expanded);

      expect(collapseItem?.iconClassName).toBe('table-collapse-all');
    });

    it('should show collapse icon when panel is expanded', () => {
      mockVizPanel.state.collapsed = false;

      const menu = new PanelMenu({ addInvestigationsLink: false });
      menu.activate();

      const items = menu.state.body?.state.items;
      const collapseItem = items?.find((item: PanelMenuItem) => item.text === CollapsablePanelText.collapsed);

      expect(collapseItem?.iconClassName).toBe('table-expand-all');
    });
  });

  describe('Add to Dashboards', () => {
    it('should not show the option if the exposed component does not exist', () => {
      jest.mocked(usePluginComponent).mockReturnValue({ component: null, isLoading: false });

      const menu = new PanelMenu({ addInvestigationsLink: false });
      menu.activate();

      render(<PanelMenu.Component model={menu} />);

      const items = menu.state.body?.state.items;
      expect(items).not.toContainEqual(
        expect.objectContaining({
          text: 'Add to Dashboard',
          iconClassName: 'apps',
        })
      );
    });

    it('should show the option if the exposed component exists', () => {
      jest.mocked(usePluginComponent).mockReturnValue({ component: () => null, isLoading: false });

      const menu = new PanelMenu({ addInvestigationsLink: false });
      menu.activate();

      render(<PanelMenu.Component model={menu} />);

      const items = menu.state.body?.state.items;
      expect(items).toContainEqual(
        expect.objectContaining({
          text: 'Add to Dashboard',
          iconClassName: 'apps',
        })
      );
    });
  });
});
