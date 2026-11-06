import { ChangeEvent } from 'react';

import { AdHocFilterWithLabels, SceneVariableValueChangedEvent } from '@grafana/scenes';

import {
  applyLogSelectionToLineFilters,
  lineFilterRowIsEmpty,
  LineFilterVariablesScene,
  nextLineFilterKeyLabel,
} from './LineFilterVariablesScene';
import { LINE_FILTER_INPUT_DEBOUNCE_MS, LineFilterCaseSensitive, LineFilterOp } from 'services/filterTypes';

const mockGetLineFiltersVariable = jest.fn();

jest.mock('services/variableGetters', () => ({
  getLineFiltersVariable: (...args: unknown[]) => mockGetLineFiltersVariable(...args),
}));

describe('lineFilterRowIsEmpty', () => {
  it('treats undefined, empty, and whitespace-only as empty', () => {
    expect(
      lineFilterRowIsEmpty({
        key: '',
        operator: LineFilterOp.match,
        value: undefined,
      } as unknown as AdHocFilterWithLabels)
    ).toBe(true);
    expect(lineFilterRowIsEmpty({ key: '', operator: LineFilterOp.match, value: '' } as AdHocFilterWithLabels)).toBe(
      true
    );
    expect(
      lineFilterRowIsEmpty({ key: '', operator: LineFilterOp.match, value: '  \t' } as AdHocFilterWithLabels)
    ).toBe(true);
  });

  it('treats non-whitespace value as non-empty', () => {
    expect(lineFilterRowIsEmpty({ key: '', operator: LineFilterOp.match, value: 'x' } as AdHocFilterWithLabels)).toBe(
      false
    );
  });
});

describe('applyLogSelectionToLineFilters', () => {
  it('fills the first empty row without adding a filter', () => {
    const filters: AdHocFilterWithLabels[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        keyLabel: '0',
        operator: LineFilterOp.regex,
        value: '',
      },
    ];
    const next = applyLogSelectionToLineFilters(filters, 'caller=instance.go', LineFilterOp.match);
    expect(next).toHaveLength(1);
    expect(next[0].value).toBe('caller=instance.go');
    expect(next[0].operator).toBe(LineFilterOp.match);
    expect(next[0].key).toBe(LineFilterCaseSensitive.caseInsensitive);
    expect(next[0].keyLabel).toBe('0');
  });

  it('uses first empty row when multiple rows exist', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: LineFilterCaseSensitive.caseSensitive, keyLabel: '0', operator: LineFilterOp.match, value: 'a' },
      { key: LineFilterCaseSensitive.caseSensitive, keyLabel: '1', operator: LineFilterOp.match, value: '' },
    ];
    const next = applyLogSelectionToLineFilters(filters, 'b', LineFilterOp.negativeMatch);
    expect(next).toHaveLength(2);
    expect(next[0].value).toBe('a');
    expect(next[1].value).toBe('b');
    expect(next[1].operator).toBe(LineFilterOp.negativeMatch);
  });

  it('appends with nextLineFilterKeyLabel when no empty row', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: LineFilterCaseSensitive.caseSensitive, keyLabel: '0', operator: LineFilterOp.match, value: 'a' },
      { key: LineFilterCaseSensitive.caseSensitive, keyLabel: '2', operator: LineFilterOp.match, value: 'b' },
    ];
    const next = applyLogSelectionToLineFilters(filters, 'c', LineFilterOp.match);
    expect(next).toHaveLength(3);
    expect(next[2].value).toBe('c');
    expect(next[2].operator).toBe(LineFilterOp.match);
    expect(next[2].key).toBe(LineFilterCaseSensitive.caseSensitive);
    expect(next[2].keyLabel).toBe(nextLineFilterKeyLabel(filters));
    expect(next[2].keyLabel).toBe('3');
  });

  it('appends to empty filters array', () => {
    const next = applyLogSelectionToLineFilters([], 'x', LineFilterOp.match);
    expect(next).toHaveLength(1);
    expect(next[0].value).toBe('x');
    expect(next[0].key).toBe(LineFilterCaseSensitive.caseSensitive);
    expect(next[0].keyLabel).toBe('0');
  });
});

describe('line filter debounce vs toggles', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function setupScene(filter: AdHocFilterWithLabels) {
    let filters: AdHocFilterWithLabels[] = [{ ...filter }];
    const variable = {
      publishEvent: jest.fn(),
      state: { filterExpression: '', filters },
      updateFilters: jest.fn((newFilters: AdHocFilterWithLabels[]) => {
        filters = newFilters;
        // Only filters with a value contribute to the expression, as in scenes
        variable.state.filterExpression = newFilters
          .filter((f) => f.value)
          .map((f) => `${f.key} ${f.operator} ${f.value}`)
          .join(', ');
      }),
    };
    mockGetLineFiltersVariable.mockReturnValue(variable);
    const scene = new LineFilterVariablesScene({});
    return {
      scene,
      filter,
      get filters() {
        return filters;
      },
      publishEvent: variable.publishEvent,
      updateFilters: variable.updateFilters,
    };
  }

  it('does not revert operator when exclude is toggled before debounced text update fires', () => {
    const filter: AdHocFilterWithLabels = {
      key: LineFilterCaseSensitive.caseInsensitive,
      keyLabel: '0',
      operator: LineFilterOp.match,
      value: '',
    };
    const ctx = setupScene(filter);
    ctx.scene.onInputChange({ target: { value: 'error' } } as ChangeEvent<HTMLInputElement>, filter);
    ctx.scene.onToggleExclusive({ ...filter, value: 'error' });

    expect(ctx.filters[0]?.operator).toBe(LineFilterOp.negativeMatch);

    jest.advanceTimersByTime(LINE_FILTER_INPUT_DEBOUNCE_MS);

    expect(ctx.updateFilters.mock.calls.at(-1)?.[0][0]?.operator).toBe(LineFilterOp.negativeMatch);
  });

  it('does not revert operator when regex is toggled before debounced text update fires', () => {
    const filter: AdHocFilterWithLabels = {
      key: LineFilterCaseSensitive.caseInsensitive,
      keyLabel: '0',
      operator: LineFilterOp.match,
      value: '',
    };
    const ctx = setupScene(filter);
    ctx.scene.onInputChange({ target: { value: 'error' } } as ChangeEvent<HTMLInputElement>, filter);
    ctx.scene.onRegexToggle({ ...filter, value: 'error' });

    expect(ctx.filters[0]?.operator).toBe(LineFilterOp.regex);

    jest.advanceTimersByTime(LINE_FILTER_INPUT_DEBOUNCE_MS);

    expect(ctx.updateFilters.mock.calls.at(-1)?.[0][0]?.operator).toBe(LineFilterOp.regex);
  });

  it('does not revert case sensitivity when toggled before debounced text update fires', () => {
    const filter: AdHocFilterWithLabels = {
      key: LineFilterCaseSensitive.caseInsensitive,
      keyLabel: '0',
      operator: LineFilterOp.match,
      value: '',
    };
    const ctx = setupScene(filter);
    ctx.scene.onInputChange({ target: { value: 'error' } } as ChangeEvent<HTMLInputElement>, filter);
    ctx.scene.onCaseSensitiveToggle({ ...filter, value: 'error' });

    expect(ctx.filters[0]?.key).toBe(LineFilterCaseSensitive.caseSensitive);

    jest.advanceTimersByTime(LINE_FILTER_INPUT_DEBOUNCE_MS);

    expect(ctx.updateFilters.mock.calls.at(-1)?.[0][0]?.key).toBe(LineFilterCaseSensitive.caseSensitive);
  });
});

describe('line filter value change events', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const emptyFilter: AdHocFilterWithLabels = {
    key: LineFilterCaseSensitive.caseInsensitive,
    keyLabel: '0',
    operator: LineFilterOp.match,
    value: '',
  };

  function setup(filter: AdHocFilterWithLabels) {
    const filters: AdHocFilterWithLabels[] = [{ ...filter }];
    const variable = {
      publishEvent: jest.fn(),
      state: { filterExpression: filter.value ? `${filter.key} ${filter.operator} ${filter.value}` : '', filters },
      updateFilters: jest.fn((newFilters: AdHocFilterWithLabels[]) => {
        variable.state.filterExpression = newFilters
          .filter((f) => f.value)
          .map((f) => `${f.key} ${f.operator} ${f.value}`)
          .join(', ');
      }),
    };
    mockGetLineFiltersVariable.mockReturnValue(variable);
    return { scene: new LineFilterVariablesScene({}), variable };
  }

  it('does not publish when toggling regex or case on an empty filter', () => {
    const { scene, variable } = setup(emptyFilter);

    scene.onRegexToggle(emptyFilter);
    scene.onCaseSensitiveToggle(emptyFilter);

    expect(variable.updateFilters).toHaveBeenCalledTimes(2);
    expect(variable.publishEvent).not.toHaveBeenCalled();
  });

  it('publishes when toggling regex on a filter with a value', () => {
    const filter = { ...emptyFilter, value: 'error' };
    const { scene, variable } = setup(filter);

    scene.onRegexToggle(filter);

    expect(variable.publishEvent).toHaveBeenCalledTimes(1);
    expect(variable.publishEvent).toHaveBeenCalledWith(expect.any(SceneVariableValueChangedEvent), true);
  });

  it('does not publish when ensuring or adding an empty row', () => {
    const { scene, variable } = setup(emptyFilter);
    variable.state.filters = [];

    scene.ensureAtLeastOneEmptyLineFilter();
    scene.addLineFilter();

    expect(variable.updateFilters).toHaveBeenCalledTimes(2);
    expect(variable.publishEvent).not.toHaveBeenCalled();
  });

  it('publishes when removing a filter that has a value', () => {
    const filter = { ...emptyFilter, value: 'error' };
    const { scene, variable } = setup(filter);

    scene.removeFilter(filter);

    expect(variable.publishEvent).toHaveBeenCalledTimes(1);
  });

  it('does not publish when removing an empty filter', () => {
    const { scene, variable } = setup(emptyFilter);

    scene.removeFilter(emptyFilter);

    expect(variable.publishEvent).not.toHaveBeenCalled();
  });

  it('publishes once, after the debounce, when the text changes', () => {
    const { scene, variable } = setup(emptyFilter);

    scene.onInputChange({ target: { value: 'error' } } as ChangeEvent<HTMLInputElement>, emptyFilter);
    expect(variable.publishEvent).not.toHaveBeenCalled();

    jest.advanceTimersByTime(LINE_FILTER_INPUT_DEBOUNCE_MS);
    expect(variable.publishEvent).toHaveBeenCalledTimes(1);
  });
});
