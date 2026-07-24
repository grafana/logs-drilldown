import { AdHocFiltersVariable, AdHocFilterWithLabels, sceneGraph, SceneObject, SceneVariables } from '@grafana/scenes';

import { runSceneQueries } from './query';
import { getRouteParams } from './routing';
import { clearMaxLines, getMaxLines } from './store';
import { areLabelFiltersEqual, clearVariables, getVariablesThatCanBeCleared } from './variableHelpers';
import { SERVICE_NAME, SERVICE_UI_LABEL, VAR_FIELDS, VAR_LABELS, VAR_LINE_FILTERS } from './variables';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { LineLimitScene } from 'Components/ServiceScene/LineLimitScene';

// Mock dependencies
jest.mock('./store');

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: {
    findDescendents: jest.fn(() => []),
    getVariables: jest.fn(),
    getAncestor: jest.fn(),
  },
}));

jest.mock('./routing', () => ({
  getRouteParams: jest.fn(),
}));

jest.mock('./query', () => ({
  runSceneQueries: jest.fn(),
}));

describe('areLabelFiltersEqual', () => {
  test('Compares label filters', () => {
    const a = [
      { key: 'k1', operator: '=', value: 'v1' },
      { key: 'k2', operator: '!=', value: 'v2' },
    ];
    const b = [
      { key: 'k2', operator: '!=', value: 'v2' },
      { key: 'k1', operator: '=', value: 'v1' },
    ];
    const c = [
      { key: 'k1', operator: '=', value: 'v1' },
      { key: 'k2', operator: '=', value: 'v2' },
    ];
    const d = [
      { key: 'k1', operator: '=', value: 'v1' },
      { key: 'k2', operator: '!=', value: 'v3' },
    ];
    const e = [{ key: 'k1', operator: '=', value: 'v1' }];
    const f = [
      { key: 'k1', operator: '=', value: 'v1' },
      { key: 'k2', operator: '!=', value: 'v2', foo: 1 },
    ];

    expect(areLabelFiltersEqual(a, b)).toBe(true);
    expect(areLabelFiltersEqual(a, c)).toBe(false);
    expect(areLabelFiltersEqual(a, d)).toBe(false);
    expect(areLabelFiltersEqual(a, e)).toBe(false);
    expect(areLabelFiltersEqual(a, f)).toBe(true);
  });
});

describe('getVariablesThatCanBeCleared', () => {
  function setup(
    initialLabelFilters: AdHocFilterWithLabels[] = [],
    initialFieldFilters: AdHocFilterWithLabels[] = [],
    defaultLineFilters: AdHocFilterWithLabels[] = [],
    primaryLabelName = SERVICE_NAME
  ) {
    const labelVariable = new AdHocFiltersVariable({
      key: 'adhoc_service_filter',
      label: 'Labels',
      layout: 'combobox',
      name: VAR_LABELS,
      filters: initialLabelFilters,
    });

    const fieldsVariable = new AdHocFiltersVariable({
      label: 'Detected fields',
      layout: 'combobox',
      name: VAR_FIELDS,
      filters: initialFieldFilters,
    });

    const lineFiltersVariable = new AdHocFiltersVariable({
      filters:
        defaultLineFilters?.map((lineFilter, index) => ({
          ...lineFilter,
          keyLabel: index.toString(),
        })) ?? [],
      layout: 'horizontal',
      name: VAR_LINE_FILTERS,
    });

    jest.mocked(sceneGraph.getVariables).mockReturnValue({
      state: {
        variables: [labelVariable, fieldsVariable, lineFiltersVariable],
      },
    } as unknown as SceneVariables);

    jest
      .mocked(getRouteParams)
      .mockReturnValue({ labelName: primaryLabelName, labelValue: 'test', breakdownLabel: undefined });
  }
  // @ts-expect-error
  const indexScene: IndexScene = {};

  test('Returns an empty array when the filters are empty', () => {
    setup();

    expect(getVariablesThatCanBeCleared(indexScene)).toEqual([]);
  });

  test.each([SERVICE_NAME, SERVICE_UI_LABEL])(
    'Returns an empty array when the label filter is the primary label',
    (primaryLabelName: string) => {
      setup(
        [
          {
            key: primaryLabelName,
            operator: '=',
            value: 'test',
          },
        ],
        [],
        [],
        primaryLabelName
      );

      expect(getVariablesThatCanBeCleared(indexScene)).toEqual([]);
    }
  );

  test.each([SERVICE_NAME, SERVICE_UI_LABEL])(
    'Returns the labels variable when there is more than one label filter',
    (primaryLabelName: string) => {
      setup(
        [
          {
            key: primaryLabelName,
            operator: '=',
            value: 'test',
          },
          {
            key: 'test',
            operator: '=',
            value: 'test',
          },
        ],
        [],
        [],
        primaryLabelName
      );

      const variables = getVariablesThatCanBeCleared(indexScene);

      expect(variables[0].state.name).toEqual(VAR_LABELS);
    }
  );

  test.each([SERVICE_NAME, SERVICE_UI_LABEL])('Returns the labels and fields variables', (primaryLabelName: string) => {
    setup(
      [
        {
          key: primaryLabelName,
          operator: '=',
          value: 'test',
        },
        {
          key: 'test',
          operator: '=',
          value: 'test',
        },
      ],
      [
        {
          key: 'test',
          operator: '=',
          value: 'test',
        },
      ],
      [],
      primaryLabelName
    );

    const variables = getVariablesThatCanBeCleared(indexScene);

    expect(variables[0].state.name).toEqual(VAR_LABELS);
  });

  test.each([SERVICE_NAME, SERVICE_UI_LABEL])(
    'Returns the labels, fields, and line filters variables',
    (primaryLabelName: string) => {
      setup(
        [
          {
            key: primaryLabelName,
            operator: '=',
            value: 'test',
          },
          {
            key: 'test',
            operator: '=',
            value: 'test',
          },
        ],
        [
          {
            key: 'test',
            operator: '=',
            value: 'test',
          },
        ],
        [
          {
            key: 'test',
            operator: '=',
            value: 'test',
          },
        ],
        primaryLabelName
      );

      const variables = getVariablesThatCanBeCleared(indexScene);
      expect(variables).toHaveLength(3);
    }
  );

  test.each([SERVICE_NAME, SERVICE_UI_LABEL])(
    'Returns the fields and line filters variables',
    (primaryLabelName: string) => {
      setup(
        [
          {
            key: primaryLabelName,
            operator: '=',
            value: 'test',
          },
        ],
        [
          {
            key: 'test',
            operator: '=',
            value: 'test',
          },
        ],
        [
          {
            key: 'test',
            operator: '=',
            value: 'test',
          },
        ],
        primaryLabelName
      );

      const variables = getVariablesThatCanBeCleared(indexScene);
      expect(variables).toHaveLength(2);
    }
  );
});

describe('clearVariables', () => {
  const sceneRef = {} as SceneObject;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getMaxLines).mockReturnValue(1000);
    jest.mocked(sceneGraph.getAncestor).mockReturnValue({
      setState: jest.fn(),
    } as unknown as IndexScene);
    jest.mocked(sceneGraph.getVariables).mockReturnValue({
      state: { variables: [] },
    } as unknown as SceneVariables);
  });

  it('clears max lines storage and re-runs queries', () => {
    clearVariables(sceneRef);

    expect(clearMaxLines).toHaveBeenCalledWith(sceneRef);
    expect(getMaxLines).toHaveBeenCalledWith(sceneRef);
    expect(runSceneQueries).toHaveBeenCalledWith(sceneRef);
  });

  it('marks line limit invalid after clear when default exceeds the limit', () => {
    const lineLimitScene = new LineLimitScene({});
    const indexScene = { setState: jest.fn() } as unknown as IndexScene;

    jest.mocked(getMaxLines).mockReturnValue(6000);
    jest.mocked(sceneGraph.findDescendents).mockReturnValue([lineLimitScene]);
    jest.mocked(sceneGraph.getAncestor).mockImplementation((ref) => {
      if (ref === lineLimitScene) {
        return { state: { ds: { maxLines: 5000 }, lokiConfig: undefined } } as IndexScene;
      }
      return indexScene;
    });

    clearVariables(sceneRef);

    expect(lineLimitScene.state.isInvalid).toBe(true);
    expect(lineLimitScene.state.maxLines).toBe(6000);
  });
});
