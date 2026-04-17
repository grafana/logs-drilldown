export interface AttributeConfig {
  attribute: string;
  attribute_name: string; // or display_name
}

export interface AttributeValueCount {
  count: number;
  percentage: number;
  value: string;
}

export interface ActiveFilter {
  field: string;
  operator: '!=' | '=';
  value: string;
}

// A value entry extended with a `retained` flag used for the sticky values pattern.
export interface DisplayValue extends AttributeValueCount {
  // Values absent from the current filtered result, shown at 0% and dimmed.
  retained: boolean;
}

export interface AttributeState {
  error: boolean;
  expanded: boolean;
  loading: boolean;
  values: AttributeValueCount[];
}

export interface State {
  attributes: AttributeConfig[];
  data: Record<string, AttributeState>;
  detecting: boolean;
  selectedFilters: ActiveFilter[];
  // Attributes the user explicitly pinned via the search combobox.
  // Rendered between priority and non-priority fields, always visible.
  userPinnedAttributes: string[];
  // Snapshot of value lists per field, taken the moment the first filter is applied.
  // Retained until all filters are cleared. null when no filters are active.
  valueSnapshot: Record<string, AttributeValueCount[]> | null;
}

export type Action =
  | { type: 'DETECTING' }
  | { configs: AttributeConfig[]; type: 'SET_ATTRIBUTES' }
  | { field: string; type: 'LOADING' }
  | { field: string; type: 'LOADED'; values: AttributeValueCount[] }
  | { field: string; type: 'ERROR' }
  | { field: string; type: 'TOGGLE_EXPANDED' }
  | { attribute: string; type: 'PIN_ATTRIBUTE' }
  | { field: string; operator: '!=' | '='; type: 'TOGGLE_FILTER'; value: string }
  | { type: 'CLEAR_FILTERS' }
  | { filters: ActiveFilter[]; type: 'SET_FILTERS' };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'DETECTING': {
      const resetData: Record<string, AttributeState> = {};
      for (const [field, attrState] of Object.entries(state.data)) {
        resetData[field] = { error: false, expanded: attrState.expanded, loading: true, values: [] };
      }
      return { ...state, data: resetData, detecting: true, valueSnapshot: null };
    }
    case 'SET_ATTRIBUTES': {
      const detectedFields = new Set(action.configs.map((c) => c.attribute));
      const userAdded = state.attributes.filter((a) => !detectedFields.has(a.attribute));
      const merged = [...action.configs, ...userAdded];
      const data: Record<string, AttributeState> = {};
      for (const c of merged) {
        data[c.attribute] = state.data[c.attribute] ?? { error: false, expanded: false, loading: true, values: [] };
      }
      return { ...state, attributes: merged, data, detecting: false };
    }
    case 'LOADING': {
      const existing = state.data[action.field];
      return {
        ...state,
        data: {
          ...state.data,
          // Keep existing values so bars remain visible during reload instead of collapsing.
          [action.field]: { error: false, expanded: existing?.expanded ?? false, loading: true, values: existing?.values ?? [] },
        },
      };
    }
    case 'LOADED':
      return {
        ...state,
        data: {
          ...state.data,
          [action.field]: {
            error: false,
            expanded: state.data[action.field]?.expanded ?? false,
            loading: false,
            values: action.values,
          },
        },
      };
    case 'ERROR':
      return {
        ...state,
        data: {
          ...state.data,
          [action.field]: {
            error: true,
            expanded: state.data[action.field]?.expanded ?? false,
            loading: false,
            values: [],
          },
        },
      };
    case 'TOGGLE_EXPANDED':
      return {
        ...state,
        data: {
          ...state.data,
          [action.field]: {
            ...state.data[action.field],
            expanded: !state.data[action.field]?.expanded,
          },
        },
      };
    case 'PIN_ATTRIBUTE':
      if (state.userPinnedAttributes.includes(action.attribute)) {
        return state;
      }
      return { ...state, userPinnedAttributes: [...state.userPinnedAttributes, action.attribute] };
    case 'TOGGLE_FILTER': {
      const { field, value, operator } = action;
      const existingIndex = state.selectedFilters.findIndex((f) => f.field === field && f.value === value);
      const existingForField = state.selectedFilters.find((f) => f.field === field);

      let newFilters: ActiveFilter[];
      if (existingIndex >= 0 && state.selectedFilters[existingIndex].operator === operator) {
        // Same operator: deselect
        newFilters = state.selectedFilters.filter((_, i) => i !== existingIndex);
      } else if (existingIndex >= 0) {
        // Operator switch for this value: replace in place
        newFilters = state.selectedFilters.map((f, i) => (i === existingIndex ? { ...f, operator } : f));
      } else if (existingForField && existingForField.operator !== operator) {
        // Different operator already active for this field: clear and add new
        newFilters = [...state.selectedFilters.filter((f) => f.field !== field), { field, value, operator }];
      } else {
        newFilters = [...state.selectedFilters, { field, value, operator }];
      }

      // Take a snapshot of current values when the first filter is added.
      let { valueSnapshot } = state;
      if (state.selectedFilters.length === 0 && newFilters.length > 0) {
        valueSnapshot = {};
        for (const [f, attrState] of Object.entries(state.data)) {
          valueSnapshot[f] = attrState.values;
        }
      }
      if (newFilters.length === 0) {
        valueSnapshot = null;
      }

      return { ...state, selectedFilters: newFilters, valueSnapshot };
    }
    case 'CLEAR_FILTERS':
      return { ...state, selectedFilters: [], valueSnapshot: null };
    case 'SET_FILTERS': {
      let { valueSnapshot } = state;
      if (action.filters.length === 0) {
        valueSnapshot = null;
      } else if (state.selectedFilters.length === 0 && valueSnapshot === null) {
        // Going from no filters to some: take a snapshot so retained values appear.
        valueSnapshot = {};
        for (const [f, attrState] of Object.entries(state.data)) {
          valueSnapshot[f] = attrState.values;
        }
      }
      return { ...state, selectedFilters: action.filters, valueSnapshot };
    }
    default:
      return state;
  }
}

export function orderByPriority(detected: AttributeConfig[], priority: AttributeConfig[]): AttributeConfig[] {
  if (!priority.length) {
    return detected;
  }
  const detectedByField = new Map(detected.map((a) => [a.attribute, a]));
  // Always include all priority attributes. Use the detected version if present
  // (it carries the attribute_name from the consumer's attributeMap); otherwise use the priority
  // config directly so the section still appears even when the field is absent from
  // detected_fields for this error group.
  const priorityFirst = priority.map((p) => detectedByField.get(p.attribute) ?? p);
  const priorityFields = new Set(priority.map((p) => p.attribute));
  const rest = detected.filter((a) => !priorityFields.has(a.attribute));
  return [...priorityFirst, ...rest];
}

// Merges current distribution values with snapshot values.
// Values in the snapshot but absent from current results are appended at 0%
// and marked retained; they remain visible and selectable after filtering.
export function mergeWithSnapshot(
  current: AttributeValueCount[],
  snapshot: AttributeValueCount[] | null
): DisplayValue[] {
  if (!snapshot) {
    return current.map((v) => ({ ...v, retained: false }));
  }
  const currentByValue = new Map(current.map((v) => [v.value, v]));
  const result: DisplayValue[] = current.map((v) => ({ ...v, retained: false }));
  for (const snap of snapshot) {
    if (!currentByValue.has(snap.value)) {
      result.push({ value: snap.value, count: 0, percentage: 0, retained: true });
    }
  }
  return result;
}
