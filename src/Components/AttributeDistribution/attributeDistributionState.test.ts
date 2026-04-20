import {
  AttributeConfig,
  AttributeValueCount,
  State,
  mergeWithSnapshot,
  orderByPriority,
  reducer,
} from './attributeDistributionState';

const attr = (attribute: string, attribute_name = attribute): AttributeConfig => ({ attribute, attribute_name });

const val = (value: string, count: number, percentage: number): AttributeValueCount => ({ count, percentage, value });

function emptyState(): State {
  return {
    attributes: [],
    data: {},
    detecting: false,
    selectedFilters: [],
    userPinnedAttributes: [],
    valueSnapshot: null,
  };
}

// ---------------------------------------------------------------------------
// reducer
// ---------------------------------------------------------------------------

describe('reducer', () => {
  describe('DETECTING', () => {
    it('sets detecting to true', () => {
      const state = reducer(emptyState(), { type: 'DETECTING' });
      expect(state.detecting).toBe(true);
    });
  });

  describe('SET_ATTRIBUTES', () => {
    it('replaces attributes and builds data map', () => {
      const configs = [attr('browser'), attr('os')];
      const state = reducer(emptyState(), { configs, type: 'SET_ATTRIBUTES' });
      expect(state.attributes).toEqual(configs);
      expect(state.data['browser']).toEqual({ error: false, expanded: false, loading: true, values: [] });
      expect(state.data['os']).toEqual({ error: false, expanded: false, loading: true, values: [] });
      expect(state.detecting).toBe(false);
    });

    it('preserves existing data state for known fields', () => {
      const initial: State = {
        ...emptyState(),
        attributes: [attr('browser')],
        data: { browser: { error: false, expanded: true, loading: false, values: [val('Chrome', 10, 100)] } },
      };
      const state = reducer(initial, { configs: [attr('browser')], type: 'SET_ATTRIBUTES' });
      expect(state.data['browser'].expanded).toBe(true);
      expect(state.data['browser'].values).toEqual([val('Chrome', 10, 100)]);
    });

    it('retains user-added attributes not in detected set', () => {
      const initial: State = {
        ...emptyState(),
        attributes: [attr('custom_field')],
        data: { custom_field: { error: false, expanded: false, loading: false, values: [] } },
        userPinnedAttributes: ['custom_field'],
      };
      const state = reducer(initial, { configs: [attr('browser')], type: 'SET_ATTRIBUTES' });
      expect(state.attributes.map((a) => a.attribute)).toContain('custom_field');
    });
  });

  describe('LOADING', () => {
    it('sets loading true and preserves existing values', () => {
      const initial: State = {
        ...emptyState(),
        data: { browser: { error: 'Failed to load', expanded: true, loading: false, values: [val('Chrome', 5, 100)] } },
      };
      const state = reducer(initial, { field: 'browser', type: 'LOADING' });
      expect(state.data['browser']).toEqual({ error: false, expanded: true, loading: true, values: [val('Chrome', 5, 100)] });
    });

    it('preserves expanded state from existing data', () => {
      const initial: State = {
        ...emptyState(),
        data: { browser: { error: false, expanded: true, loading: false, values: [] } },
      };
      const state = reducer(initial, { field: 'browser', type: 'LOADING' });
      expect(state.data['browser'].expanded).toBe(true);
    });
  });

  describe('LOADED', () => {
    it('sets values and clears loading and error', () => {
      const values = [val('Chrome', 10, 80), val('Firefox', 2, 20)];
      const initial: State = {
        ...emptyState(),
        data: { browser: { error: 'Failed to load', expanded: false, loading: true, values: [] } },
      };
      const state = reducer(initial, { field: 'browser', type: 'LOADED', values });
      expect(state.data['browser']).toEqual({ error: false, expanded: false, loading: false, values });
    });
  });

  describe('ERROR', () => {
    it('stores the error message and clears loading and values', () => {
      const initial: State = {
        ...emptyState(),
        data: { browser: { error: false, expanded: true, loading: true, values: [] } },
      };
      const state = reducer(initial, { field: 'browser', message: 'Failed to load', type: 'ERROR' });
      expect(state.data['browser']).toEqual({ error: 'Failed to load', expanded: true, loading: false, values: [] });
    });


  });

  describe('TOGGLE_EXPANDED', () => {
    it('toggles expanded from false to true', () => {
      const initial: State = {
        ...emptyState(),
        data: { browser: { error: false, expanded: false, loading: false, values: [] } },
      };
      const state = reducer(initial, { field: 'browser', type: 'TOGGLE_EXPANDED' });
      expect(state.data['browser'].expanded).toBe(true);
    });

    it('toggles expanded from true to false', () => {
      const initial: State = {
        ...emptyState(),
        data: { browser: { error: false, expanded: true, loading: false, values: [] } },
      };
      const state = reducer(initial, { field: 'browser', type: 'TOGGLE_EXPANDED' });
      expect(state.data['browser'].expanded).toBe(false);
    });
  });

  describe('PIN_ATTRIBUTE', () => {
    it('adds a new attribute to userPinnedAttributes', () => {
      const state = reducer(emptyState(), { attribute: 'country', type: 'PIN_ATTRIBUTE' });
      expect(state.userPinnedAttributes).toEqual(['country']);
    });

    it('does not duplicate an already-pinned attribute', () => {
      const initial: State = { ...emptyState(), userPinnedAttributes: ['country'] };
      const state = reducer(initial, { attribute: 'country', type: 'PIN_ATTRIBUTE' });
      expect(state.userPinnedAttributes).toEqual(['country']);
      expect(state).toBe(initial); // same reference; no new state
    });

    it('appends to existing pinned attributes', () => {
      const initial: State = { ...emptyState(), userPinnedAttributes: ['country'] };
      const state = reducer(initial, { attribute: 'os', type: 'PIN_ATTRIBUTE' });
      expect(state.userPinnedAttributes).toEqual(['country', 'os']);
    });
  });

  describe('TOGGLE_FILTER', () => {
    it('adds a new include filter', () => {
      const state = reducer(emptyState(), { field: 'browser', operator: '=', type: 'TOGGLE_FILTER', value: 'Chrome' });
      expect(state.selectedFilters).toEqual([{ field: 'browser', operator: '=', value: 'Chrome' }]);
    });

    it('adds a new exclude filter', () => {
      const state = reducer(emptyState(), {
        field: 'browser',
        operator: '!=',
        type: 'TOGGLE_FILTER',
        value: 'Chrome',
      });
      expect(state.selectedFilters).toEqual([{ field: 'browser', operator: '!=', value: 'Chrome' }]);
    });

    it('deselects a filter when toggled with the same operator', () => {
      const initial: State = {
        ...emptyState(),
        selectedFilters: [{ field: 'browser', operator: '=', value: 'Chrome' }],
      };
      const state = reducer(initial, { field: 'browser', operator: '=', type: 'TOGGLE_FILTER', value: 'Chrome' });
      expect(state.selectedFilters).toEqual([]);
    });

    it('switches operator when toggled with a different operator', () => {
      const initial: State = {
        ...emptyState(),
        selectedFilters: [{ field: 'browser', operator: '=', value: 'Chrome' }],
      };
      const state = reducer(initial, { field: 'browser', operator: '!=', type: 'TOGGLE_FILTER', value: 'Chrome' });
      expect(state.selectedFilters).toEqual([{ field: 'browser', operator: '!=', value: 'Chrome' }]);
    });

    it('clears field and adds new value when operator changes across values', () => {
      // Field has an include filter. Excluding a different value clears all include filters for that field.
      const initial: State = {
        ...emptyState(),
        selectedFilters: [{ field: 'browser', operator: '=', value: 'Chrome' }],
      };
      const state = reducer(initial, { field: 'browser', operator: '!=', type: 'TOGGLE_FILTER', value: 'Firefox' });
      expect(state.selectedFilters).toEqual([{ field: 'browser', operator: '!=', value: 'Firefox' }]);
    });

    it('clears sibling values when switching operator for an existing value', () => {
      // Chrome and Firefox both included. Switching Chrome to exclude must remove Firefox too
      // so the field never holds mixed operators.
      const initial: State = {
        ...emptyState(),
        selectedFilters: [
          { field: 'browser', operator: '=', value: 'Chrome' },
          { field: 'browser', operator: '=', value: 'Firefox' },
        ],
      };
      const state = reducer(initial, { field: 'browser', operator: '!=', type: 'TOGGLE_FILTER', value: 'Chrome' });
      expect(state.selectedFilters).toEqual([{ field: 'browser', operator: '!=', value: 'Chrome' }]);
    });

    it('allows multiple values for the same field with the same operator', () => {
      const initial: State = {
        ...emptyState(),
        selectedFilters: [{ field: 'browser', operator: '=', value: 'Chrome' }],
      };
      const state = reducer(initial, { field: 'browser', operator: '=', type: 'TOGGLE_FILTER', value: 'Firefox' });
      expect(state.selectedFilters).toHaveLength(2);
      expect(state.selectedFilters).toContainEqual({ field: 'browser', operator: '=', value: 'Firefox' });
    });

    it('takes a snapshot on first filter add', () => {
      const initial: State = {
        ...emptyState(),
        data: {
          browser: { error: false, expanded: false, loading: false, values: [val('Chrome', 10, 100)] },
        },
      };
      const state = reducer(initial, { field: 'browser', operator: '=', type: 'TOGGLE_FILTER', value: 'Chrome' });
      expect(state.valueSnapshot).toEqual({
        browser: [val('Chrome', 10, 100)],
      });
    });

    it('does not overwrite snapshot when a second filter is added', () => {
      const snapshot = { browser: [val('Chrome', 10, 100)] };
      const initial: State = {
        ...emptyState(),
        data: {
          browser: { error: false, expanded: false, loading: false, values: [val('Chrome', 5, 100)] },
          os: { error: false, expanded: false, loading: false, values: [val('macOS', 5, 100)] },
        },
        selectedFilters: [{ field: 'browser', operator: '=', value: 'Chrome' }],
        valueSnapshot: snapshot,
      };
      const state = reducer(initial, { field: 'os', operator: '=', type: 'TOGGLE_FILTER', value: 'macOS' });
      expect(state.valueSnapshot).toBe(snapshot); // unchanged reference
    });

    it('clears snapshot when the last filter is removed', () => {
      const initial: State = {
        ...emptyState(),
        selectedFilters: [{ field: 'browser', operator: '=', value: 'Chrome' }],
        valueSnapshot: { browser: [val('Chrome', 10, 100)] },
      };
      const state = reducer(initial, { field: 'browser', operator: '=', type: 'TOGGLE_FILTER', value: 'Chrome' });
      expect(state.valueSnapshot).toBeNull();
      expect(state.selectedFilters).toEqual([]);
    });
  });

  describe('SET_FILTERS', () => {
    it('replaces selectedFilters with the provided list', () => {
      const initial: State = {
        ...emptyState(),
        selectedFilters: [{ field: 'browser', operator: '=', value: 'Chrome' }],
      };
      const filters = [{ field: 'os', operator: '=' as const, value: 'macOS' }];
      const state = reducer(initial, { filters, type: 'SET_FILTERS' });
      expect(state.selectedFilters).toEqual(filters);
    });

    it('preserves valueSnapshot when new filters are non-empty', () => {
      const snapshot = { browser: [val('Chrome', 10, 100)] };
      const initial: State = {
        ...emptyState(),
        selectedFilters: [{ field: 'browser', operator: '=', value: 'Chrome' }],
        valueSnapshot: snapshot,
      };
      const filters = [{ field: 'os', operator: '=' as const, value: 'macOS' }];
      const state = reducer(initial, { filters, type: 'SET_FILTERS' });
      expect(state.valueSnapshot).toBe(snapshot);
    });

    it('clears valueSnapshot when new filters are empty', () => {
      const initial: State = {
        ...emptyState(),
        selectedFilters: [{ field: 'browser', operator: '=', value: 'Chrome' }],
        valueSnapshot: { browser: [val('Chrome', 10, 100)] },
      };
      const state = reducer(initial, { filters: [], type: 'SET_FILTERS' });
      expect(state.selectedFilters).toEqual([]);
      expect(state.valueSnapshot).toBeNull();
    });

    it('takes a snapshot when transitioning from no filters to some', () => {
      const initial: State = {
        ...emptyState(),
        data: {
          browser: { error: false, expanded: false, loading: false, values: [val('Chrome', 10, 100)] },
          os: { error: false, expanded: false, loading: false, values: [val('macOS', 5, 100)] },
        },
      };
      const filters = [{ field: 'browser', operator: '=' as const, value: 'Chrome' }];
      const state = reducer(initial, { filters, type: 'SET_FILTERS' });
      expect(state.valueSnapshot).toEqual({
        browser: [val('Chrome', 10, 100)],
        os: [val('macOS', 5, 100)],
      });
    });

    it('does not overwrite an existing snapshot when filters change', () => {
      const snapshot = { browser: [val('Chrome', 10, 100)] };
      const initial: State = {
        ...emptyState(),
        data: {
          browser: { error: false, expanded: false, loading: false, values: [val('Chrome', 5, 100)] },
        },
        selectedFilters: [{ field: 'browser', operator: '=', value: 'Chrome' }],
        valueSnapshot: snapshot,
      };
      const filters = [{ field: 'os', operator: '=' as const, value: 'macOS' }];
      const state = reducer(initial, { filters, type: 'SET_FILTERS' });
      expect(state.valueSnapshot).toBe(snapshot);
    });
  });

  describe('CLEAR_FILTERS', () => {
    it('removes all filters and snapshot', () => {
      const initial: State = {
        ...emptyState(),
        selectedFilters: [{ field: 'browser', operator: '=', value: 'Chrome' }],
        valueSnapshot: { browser: [val('Chrome', 10, 100)] },
      };
      const state = reducer(initial, { type: 'CLEAR_FILTERS' });
      expect(state.selectedFilters).toEqual([]);
      expect(state.valueSnapshot).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// orderByPriority
// ---------------------------------------------------------------------------

describe('orderByPriority', () => {
  it('returns detected as-is when priority is empty', () => {
    const detected = [attr('browser'), attr('os')];
    expect(orderByPriority(detected, [], {})).toEqual(detected);
  });

  it('puts priority fields first', () => {
    const detected = [attr('browser'), attr('os'), attr('country')];
    const result = orderByPriority(detected, ['country', 'os'], {});
    expect(result[0].attribute).toBe('country');
    expect(result[1].attribute).toBe('os');
    expect(result[2].attribute).toBe('browser');
  });

  it('uses the detected version of a priority field (carries attribute_name from attributeLabels)', () => {
    const detected = [attr('browser', 'Browser Name')];
    const result = orderByPriority(detected, ['browser'], { browser: 'Default Label' });
    expect(result[0].attribute_name).toBe('Browser Name');
  });

  it('includes a priority field absent from detected using attributeLabels for the name', () => {
    const detected = [attr('os')];
    const result = orderByPriority(detected, ['browser', 'os'], { browser: 'Browser' });
    expect(result.map((a) => a.attribute)).toEqual(['browser', 'os']);
    expect(result[0].attribute_name).toBe('Browser');
  });

  it('falls back to raw attribute name when absent from detected and not in attributeLabels', () => {
    const detected = [attr('os')];
    const result = orderByPriority(detected, ['browser', 'os'], {});
    expect(result[0].attribute_name).toBe('browser');
  });

  it('does not duplicate priority fields in the rest list', () => {
    const detected = [attr('browser'), attr('os')];
    const result = orderByPriority(detected, ['browser'], {});
    expect(result.filter((a) => a.attribute === 'browser')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// mergeWithSnapshot
// ---------------------------------------------------------------------------

describe('mergeWithSnapshot', () => {
  it('marks all values as not retained when no snapshot', () => {
    const current = [val('Chrome', 10, 80), val('Firefox', 2, 20)];
    const result = mergeWithSnapshot(current, null);
    expect(result).toEqual([
      { ...val('Chrome', 10, 80), retained: false },
      { ...val('Firefox', 2, 20), retained: false },
    ]);
  });

  it('appends snapshot values absent from current at 0% and marks retained', () => {
    const current = [val('Chrome', 10, 100)];
    const snapshot = [val('Chrome', 8, 80), val('Firefox', 2, 20)];
    const result = mergeWithSnapshot(current, snapshot);
    expect(result).toContainEqual({ value: 'Firefox', count: 0, percentage: 0, retained: true });
  });

  it('does not duplicate values present in both current and snapshot', () => {
    const current = [val('Chrome', 10, 100)];
    const snapshot = [val('Chrome', 8, 80)];
    const result = mergeWithSnapshot(current, snapshot);
    expect(result.filter((r) => r.value === 'Chrome')).toHaveLength(1);
    expect(result[0].retained).toBe(false);
  });

  it('returns an empty array when both current and snapshot are empty', () => {
    expect(mergeWithSnapshot([], [])).toEqual([]);
  });

  it('returns all snapshot values as retained when current is empty', () => {
    const snapshot = [val('Chrome', 8, 80), val('Firefox', 2, 20)];
    const result = mergeWithSnapshot([], snapshot);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.retained)).toBe(true);
    expect(result.every((r) => r.count === 0 && r.percentage === 0)).toBe(true);
  });
});
