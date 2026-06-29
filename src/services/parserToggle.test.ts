import { sceneGraph, SceneObject } from '@grafana/scenes';

import { CustomConstantVariable } from './CustomConstantVariable';
import {
  getJsonParserSegment,
  getLogfmtParserSegment,
  getParserEnabled,
  PARSER_ENABLED_LOCALSTORAGE_KEY,
  setParserEnabled,
} from './parserToggle';
import { JSON_PARSER_SEGMENT, LOGFMT_PARSER_SEGMENT, VAR_JSON_PARSER, VAR_LOGFMT_PARSER } from './variables';

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: {
    findDescendents: jest.fn(() => []),
    getAncestor: jest.fn(),
    lookupVariable: jest.fn(),
  },
}));

describe('getParserEnabled', () => {
  afterEach(() => {
    localStorage.clear();
  });

  test('defaults to true when nothing is stored', () => {
    expect(getParserEnabled()).toBe(true);
  });

  test('returns true when stored value is "true"', () => {
    localStorage.setItem(PARSER_ENABLED_LOCALSTORAGE_KEY, 'true');
    expect(getParserEnabled()).toBe(true);
  });

  test('returns false when stored value is "false"', () => {
    localStorage.setItem(PARSER_ENABLED_LOCALSTORAGE_KEY, 'false');
    expect(getParserEnabled()).toBe(false);
  });

  test('returns false when stored value is an empty string', () => {
    localStorage.setItem(PARSER_ENABLED_LOCALSTORAGE_KEY, '');
    expect(getParserEnabled()).toBe(false);
  });
});

describe('getJsonParserSegment', () => {
  afterEach(() => {
    localStorage.clear();
  });

  test('returns the JSON parser segment when enabled', () => {
    expect(getJsonParserSegment(true)).toBe(JSON_PARSER_SEGMENT);
  });

  test('returns an empty string when disabled', () => {
    expect(getJsonParserSegment(false)).toBe('');
  });

  test('falls back to the stored value when no argument is passed', () => {
    localStorage.setItem(PARSER_ENABLED_LOCALSTORAGE_KEY, 'false');
    expect(getJsonParserSegment()).toBe('');

    localStorage.setItem(PARSER_ENABLED_LOCALSTORAGE_KEY, 'true');
    expect(getJsonParserSegment()).toBe(JSON_PARSER_SEGMENT);
  });
});

describe('getLogfmtParserSegment', () => {
  afterEach(() => {
    localStorage.clear();
  });

  test('returns the logfmt parser segment when enabled', () => {
    expect(getLogfmtParserSegment(true)).toBe(LOGFMT_PARSER_SEGMENT);
  });

  test('returns an empty string when disabled', () => {
    expect(getLogfmtParserSegment(false)).toBe('');
  });

  test('falls back to the stored value when no argument is passed', () => {
    localStorage.setItem(PARSER_ENABLED_LOCALSTORAGE_KEY, 'false');
    expect(getLogfmtParserSegment()).toBe('');

    localStorage.setItem(PARSER_ENABLED_LOCALSTORAGE_KEY, 'true');
    expect(getLogfmtParserSegment()).toBe(LOGFMT_PARSER_SEGMENT);
  });
});

describe('setParserEnabled', () => {
  let jsonParserVariable: CustomConstantVariable;
  let logfmtParserVariable: CustomConstantVariable;
  let clearParserDependentFilters: jest.Mock;
  let runQueries: jest.Mock;

  const sceneRef = {} as SceneObject;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    jsonParserVariable = new CustomConstantVariable({ name: VAR_JSON_PARSER });
    logfmtParserVariable = new CustomConstantVariable({ name: VAR_LOGFMT_PARSER });
    clearParserDependentFilters = jest.fn();
    runQueries = jest.fn();

    jest.mocked(sceneGraph.lookupVariable).mockImplementation((name: string) => {
      if (name === VAR_JSON_PARSER) {
        return jsonParserVariable;
      }
      if (name === VAR_LOGFMT_PARSER) {
        return logfmtParserVariable;
      }
      return null;
    });

    jest.mocked(sceneGraph.getAncestor).mockReturnValue({ clearParserDependentFilters } as any);

    const serviceScene = {} as SceneObject;
    const queryRunner = { runQueries } as unknown as SceneObject;
    jest
      .mocked(sceneGraph.findDescendents)
      .mockReturnValueOnce([serviceScene] as any)
      .mockReturnValueOnce([queryRunner] as any);
  });

  test('persists the enabled value to local storage', () => {
    setParserEnabled(true, sceneRef);
    expect(localStorage.getItem(PARSER_ENABLED_LOCALSTORAGE_KEY)).toBe('true');

    setParserEnabled(false, sceneRef);
    expect(localStorage.getItem(PARSER_ENABLED_LOCALSTORAGE_KEY)).toBe('false');
  });

  test('updates the parser variables with the enabled segments', () => {
    setParserEnabled(true, sceneRef);

    expect(jsonParserVariable.state.value).toBe(JSON_PARSER_SEGMENT);
    expect(jsonParserVariable.state.text).toBe(JSON_PARSER_SEGMENT);
    expect(jsonParserVariable.state.options).toEqual([{ label: JSON_PARSER_SEGMENT, value: JSON_PARSER_SEGMENT }]);

    expect(logfmtParserVariable.state.value).toBe(LOGFMT_PARSER_SEGMENT);
    expect(logfmtParserVariable.state.text).toBe(LOGFMT_PARSER_SEGMENT);
    expect(logfmtParserVariable.state.options).toEqual([{ label: LOGFMT_PARSER_SEGMENT, value: LOGFMT_PARSER_SEGMENT }]);
  });

  test('clears the parser variables with empty segments when disabled', () => {
    setParserEnabled(false, sceneRef);

    expect(jsonParserVariable.state.value).toBe('');
    expect(jsonParserVariable.state.options).toEqual([{ label: '', value: '' }]);
    expect(logfmtParserVariable.state.value).toBe('');
    expect(logfmtParserVariable.state.options).toEqual([{ label: '', value: '' }]);
  });

  test('clears parser-dependent filters only when disabling', () => {
    setParserEnabled(true, sceneRef);
    expect(clearParserDependentFilters).not.toHaveBeenCalled();

    setParserEnabled(false, sceneRef);
    expect(clearParserDependentFilters).toHaveBeenCalledTimes(1);
  });

  test('re-runs parser-dependent queries on the service scene', () => {
    setParserEnabled(true, sceneRef);
    expect(runQueries).toHaveBeenCalledTimes(1);
  });

  test('does not throw when no service scene is found', () => {
    jest.mocked(sceneGraph.findDescendents).mockReset();
    jest.mocked(sceneGraph.findDescendents).mockReturnValue([] as any);

    expect(() => setParserEnabled(true, sceneRef)).not.toThrow();
    expect(runQueries).not.toHaveBeenCalled();
  });

  test('does not touch variables that are not CustomConstantVariable instances', () => {
    jest.mocked(sceneGraph.lookupVariable).mockReturnValue({ setState: jest.fn() } as unknown as ReturnType<
      typeof sceneGraph.lookupVariable
    >);

    expect(() => setParserEnabled(true, sceneRef)).not.toThrow();
  });
});
