import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BusEvent, createDataFrame, Field, FieldType, LoadingState, PanelData } from '@grafana/data';
import { AdHocFiltersVariable, sceneGraph, SceneObject, SceneQueryRunner } from '@grafana/scenes';

import { ServiceScene, ServiceSceneState } from '../ServiceScene';
import { addAdHocFilter, addToFilters, AddToFiltersButton, FilterType } from './AddToFiltersButton';
import {
  FieldValue,
  LEVEL_VARIABLE_VALUE,
  VAR_FIELDS,
  VAR_FIELDS_AND_METADATA,
  VAR_LABELS,
  VAR_LEVELS,
} from 'services/variables';

jest.mock('services/favorites', () => {
  return {
    addToFavorites: () => {},
    removeFromFavorites: () => {},
    rerenderFavorites: () => {},
  };
});

const scene = { publishEvent(event: BusEvent, bubble?: boolean) {} } as SceneObject;

describe('AddToFiltersButton', () => {
  it('updates correct variable passed to AddToFiltersButton', async () => {
    const button = new AddToFiltersButton({
      frame: createDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [0],
          },
          {
            labels: {
              test: 'error',
            },
            name: 'value',
            type: FieldType.number,
            values: [100],
          },
        ],
        name: 'frame1',
      }),
      variableName: 'filters',
    });
    const lookup = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(new AdHocFiltersVariable({}));
    render(<button.Component model={button} />);
    userEvent.click(screen.getByRole('button', { name: 'Include' }));
    await waitFor(async () => expect(lookup).toHaveBeenCalledWith('filters', expect.anything()));
  });

  it('updates correct variable when LEVEL_VARIABLE_VALUE', async () => {
    const labels: { [key: string]: string } = {};
    labels[LEVEL_VARIABLE_VALUE] = 'error';
    const button = new AddToFiltersButton({
      frame: createDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [0],
          },
          {
            labels,
            name: 'value',
            type: FieldType.number,
            values: [100],
          },
        ],
        name: 'frame2',
      }),
      variableName: VAR_LEVELS,
    });
    const lookup = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(new AdHocFiltersVariable({}));
    render(<button.Component model={button} />);
    userEvent.click(screen.getByRole('button', { name: 'Include' }));
    await waitFor(async () => expect(lookup).toHaveBeenCalledWith(VAR_LEVELS, expect.anything()));
  });
});

describe('addToFilters and addAdHocFilter', () => {
  let adHocVariable: AdHocFiltersVariable;
  let serviceScene: ServiceScene;
  beforeEach(() => {
    const labels = [
      {
        cardinality: 1,
        label: 'indexed',
      },
    ];
    const detectedLabelFields: Array<Partial<Field>> = labels?.map((label) => {
      return {
        name: label.label,
        values: [label.cardinality],
      };
    });
    const dataFrame = createDataFrame({
      fields: detectedLabelFields ?? [],
      refId: 'detected_labels',
    });
    const panelData: Partial<PanelData> = {
      series: [dataFrame],
      state: LoadingState.Done,
    };
    const state: Partial<ServiceSceneState> = {
      $detectedLabelsData: {
        state: {
          data: panelData,
          queries: [],
        },
      } as unknown as SceneQueryRunner,
    };

    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      state: state,
    });
    adHocVariable = new AdHocFiltersVariable({
      filters: [
        {
          key: 'existing',
          operator: '=',
          value: JSON.stringify({
            parser: 'mixed',
            value: 'existingValue',
          }),
          valueLabels: ['existingValue'],
        },
      ],
      name: VAR_FIELDS,
    });

    serviceScene = {
      state: {
        $detectedFieldsData: {
          state: {},
        },
      },
    } as ServiceScene;
  });

  describe('addToFilters', () => {
    it.each(['include', 'exclude'])('allows to add an %s filter', (type: string) => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(serviceScene);
      addToFilters('key', 'value', type as FilterType, scene, VAR_FIELDS);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_FIELDS_AND_METADATA, expect.anything());
      expect(adHocVariable.state.filters).toEqual([
        {
          key: 'existing',
          operator: '=',
          value: JSON.stringify({
            parser: 'mixed',
            value: 'existingValue',
          } as FieldValue),
          valueLabels: ['existingValue'],
        },
        {
          key: 'key',
          operator: type === 'include' ? '=' : '!=',
          value: JSON.stringify({
            parser: 'mixed',
            value: 'value',
          } as FieldValue),
          valueLabels: ['value'],
        },
      ]);
    });

    it('allows to toggle a filter', () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(serviceScene);
      addToFilters('existing', 'existingValue', 'toggle', scene, VAR_FIELDS);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_FIELDS_AND_METADATA, expect.anything());
      expect(adHocVariable.state.filters).toEqual([]);
    });

    it('allows to clear a filter', () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(serviceScene);
      addToFilters('existing', 'existingValue', 'clear', scene, VAR_FIELDS);
      expect(lookupVariable).toHaveBeenCalledWith(VAR_FIELDS_AND_METADATA, expect.anything());
      expect(adHocVariable.state.filters).toEqual([]);
    });

    it('allows to specify the variable to write to', () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addToFilters('key', 'value', 'include', scene, VAR_FIELDS);
      expect(lookupVariable).toHaveBeenCalledWith(VAR_FIELDS_AND_METADATA, expect.anything());
    });

    it('identifies indexed labels and uses the appropriate variable', () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(serviceScene);
      addToFilters('indexed', 'value', 'include', scene, VAR_LABELS);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_LABELS, expect.anything());
      expect(adHocVariable.state.filters).toEqual([
        {
          key: 'existing',
          operator: '=',
          value: JSON.stringify({
            parser: 'mixed',
            value: 'existingValue',
          }),
          valueLabels: ['existingValue'],
        },
        {
          key: 'indexed',
          operator: '=',
          value: 'value',
          valueLabels: ['value'],
        },
      ]);
    });

    it(`uses the correct name when filtering for ${LEVEL_VARIABLE_VALUE}`, () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(serviceScene);
      addToFilters(LEVEL_VARIABLE_VALUE, 'info', 'include', scene, VAR_LEVELS);
      expect(lookupVariable).toHaveBeenCalledWith(VAR_LEVELS, expect.anything());
    });
  });

  describe('addAdHocFilter', () => {
    it.each(['=', '!='])('allows to add an %s filter', (operator: string) => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(serviceScene);
      addAdHocFilter({ key: 'key', operator, value: 'value' }, scene, VAR_FIELDS);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_FIELDS_AND_METADATA, expect.anything());
      expect(adHocVariable.state.filters).toEqual([
        {
          key: 'existing',
          operator: '=',
          value: JSON.stringify({
            parser: 'mixed',
            value: 'existingValue',
          }),
          valueLabels: ['existingValue'],
        },
        {
          key: 'key',
          operator,
          value: JSON.stringify({
            parser: 'mixed',
            value: 'value',
          }),
          valueLabels: ['value'],
        },
      ]);
    });

    it('allows to specify the variable to write to', () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(serviceScene);
      addAdHocFilter({ key: 'key', operator: '=', value: 'value' }, scene, VAR_FIELDS);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_FIELDS_AND_METADATA, expect.anything());
    });

    it('identifies indexed labels and uses the appropriate variable', () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addToFilters('indexed', 'value', 'include', scene, 'filters');

      expect(lookupVariable).toHaveBeenCalledWith(VAR_LABELS, expect.anything());
      expect(adHocVariable.state.filters).toEqual([
        {
          key: 'existing',
          operator: '=',
          value: JSON.stringify({
            parser: 'mixed',
            value: 'existingValue',
          }),
          valueLabels: ['existingValue'],
        },
        {
          key: 'indexed',
          operator: '=',
          value: 'value',
          valueLabels: ['value'],
        },
      ]);
    });

    it(`uses the correct name when filtering for ${LEVEL_VARIABLE_VALUE}`, () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(serviceScene);
      addAdHocFilter({ key: LEVEL_VARIABLE_VALUE, operator: '=', value: 'info' }, scene, VAR_LEVELS);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_LEVELS, expect.anything());
    });
  });
});
