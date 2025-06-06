import React from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdHocFiltersVariable, SceneVariableSet } from '@grafana/scenes';

import { LineFilterCaseSensitive, LineFilterOp } from '../../../services/filterTypes';
import { renderLogQLLineFilter } from '../../../services/query';
import { LineFilterScene } from './LineFilterScene';
import { VAR_LINE_FILTER, VAR_LINE_FILTERS } from 'services/variables';

let location = {} as Location;
jest.mock('lodash/debounce', () => (fn: { cancel: jest.Mock<any, any, any>; flush: jest.Mock<any, any, any> }) => {
  fn.cancel = jest.fn();
  fn.flush = jest.fn();
  return fn;
});
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getLocation: () => location,
    getSearch: () => new URLSearchParams(location.search),
    replace: jest.fn(),
  },
}));

describe('LineFilter', () => {
  let scene: LineFilterScene;
  let lineFilterVariable: AdHocFiltersVariable;
  let lineFiltersVariable: AdHocFiltersVariable;

  describe('case insensitive, no regex', () => {
    beforeEach(() => {
      lineFilterVariable = new AdHocFiltersVariable({
        expressionBuilder: renderLogQLLineFilter,
        name: VAR_LINE_FILTER,
      });
      lineFiltersVariable = new AdHocFiltersVariable({
        expressionBuilder: renderLogQLLineFilter,
        name: VAR_LINE_FILTERS,
      });
      scene = new LineFilterScene({
        $variables: new SceneVariableSet({
          variables: [lineFilterVariable, lineFiltersVariable],
        }),
        caseSensitive: false,
        regex: false,
      });
    });

    test('Updates the variable with the user input', async () => {
      render(<scene.Component model={scene} />);
      await act(() => userEvent.type(screen.getByPlaceholderText('Search in log lines'), 'some text'));

      expect(await screen.findByDisplayValue('some text')).toBeInTheDocument();
      expect(scene.state.lineFilter).toEqual('some text');
      expect(scene.state.regex).toEqual(false);
      expect(scene.state.caseSensitive).toEqual(false);
    });

    test('Unescapes the regular expression from the variable value', async () => {
      lineFilterVariable.setState({
        filters: [
          {
            key: LineFilterCaseSensitive.caseInsensitive,
            operator: LineFilterOp.match,
            value: '(characters',
          },
        ],
      });

      render(<scene.Component model={scene} />);

      expect(await screen.findByDisplayValue('(characters')).toBeInTheDocument();
    });
  });
  describe('case sensitive, no regex', () => {
    beforeEach(() => {
      lineFilterVariable = new AdHocFiltersVariable({
        expressionBuilder: renderLogQLLineFilter,
        name: VAR_LINE_FILTER,
      });
      lineFiltersVariable = new AdHocFiltersVariable({
        expressionBuilder: renderLogQLLineFilter,
        name: VAR_LINE_FILTERS,
      });
      scene = new LineFilterScene({
        $variables: new SceneVariableSet({
          variables: [lineFilterVariable, lineFiltersVariable],
        }),
        caseSensitive: true,
      });
    });

    test('Updates the variable with the user input', async () => {
      render(<scene.Component model={scene} />);

      await act(() => userEvent.type(screen.getByPlaceholderText('Search in log lines'), 'some text'));

      expect(await screen.findByDisplayValue('some text')).toBeInTheDocument();
      expect(scene.state.lineFilter).toEqual('some text');
      expect(scene.state.regex).toEqual(false);
      expect(scene.state.caseSensitive).toEqual(true);
    });

    test('Unescapes the regular expression from the variable value', async () => {
      lineFilterVariable.setState({
        filters: [
          {
            key: LineFilterCaseSensitive.caseSensitive,
            operator: LineFilterOp.match,
            value: '(characters',
          },
        ],
      });

      render(<scene.Component model={scene} />);

      expect(await screen.findByDisplayValue('(characters')).toBeInTheDocument();
    });
  });
  describe('case insensitive, regex', () => {
    beforeEach(() => {
      lineFilterVariable = new AdHocFiltersVariable({
        expressionBuilder: renderLogQLLineFilter,
        name: VAR_LINE_FILTER,
      });
      lineFiltersVariable = new AdHocFiltersVariable({
        expressionBuilder: renderLogQLLineFilter,
        name: VAR_LINE_FILTERS,
      });
      scene = new LineFilterScene({
        $variables: new SceneVariableSet({
          variables: [lineFilterVariable, lineFiltersVariable],
        }),
        caseSensitive: false,
        regex: true,
      });
    });

    test('Updates the variable with the user input', async () => {
      render(<scene.Component model={scene} />);

      const string = `((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`;
      const input = screen.getByPlaceholderText('Search in log lines');
      await act(() => fireEvent.change(input, { target: { value: string } }));

      expect(await screen.findByDisplayValue(string)).toBeInTheDocument();
      expect(scene.state.lineFilter).toEqual(string);
      expect(scene.state.regex).toEqual(true);
      expect(scene.state.caseSensitive).toEqual(false);
    });

    test('Unescapes the regular expression from the variable value', async () => {
      const string = `((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`;
      lineFilterVariable.setState({
        filters: [
          {
            key: LineFilterCaseSensitive.caseInsensitive,
            operator: LineFilterOp.regex,
            value: string,
          },
        ],
      });
      render(<scene.Component model={scene} />);

      expect(await screen.findByDisplayValue(string)).toBeInTheDocument();
    });
  });
  describe('case sensitive, regex', () => {
    beforeEach(() => {
      lineFilterVariable = new AdHocFiltersVariable({
        expressionBuilder: renderLogQLLineFilter,
        name: VAR_LINE_FILTER,
      });
      lineFiltersVariable = new AdHocFiltersVariable({
        expressionBuilder: renderLogQLLineFilter,
        name: VAR_LINE_FILTERS,
      });
      scene = new LineFilterScene({
        $variables: new SceneVariableSet({
          variables: [lineFilterVariable, lineFiltersVariable],
        }),
        caseSensitive: true,
        regex: true,
      });
    });

    test('Updates the variable with the user input', async () => {
      render(<scene.Component model={scene} />);

      const string = `((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`;
      const input = screen.getByPlaceholderText('Search in log lines');
      await act(() => fireEvent.change(input, { target: { value: string } }));

      expect(await screen.findByDisplayValue(string)).toBeInTheDocument();
      expect(scene.state.lineFilter).toEqual(string);
      expect(scene.state.regex).toEqual(true);
      expect(scene.state.caseSensitive).toEqual(true);
    });

    test('Unescapes the regular expression from the variable value', async () => {
      const string = `((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`;
      lineFilterVariable.setState({
        filters: [
          {
            key: LineFilterCaseSensitive.caseSensitive,
            operator: LineFilterOp.regex,
            value: string,
          },
        ],
      });

      render(<scene.Component model={scene} />);

      expect(await screen.findByDisplayValue(string)).toBeInTheDocument();
    });
  });
  describe('regex validation', () => {
    beforeEach(() => {
      lineFilterVariable = new AdHocFiltersVariable({
        expressionBuilder: renderLogQLLineFilter,
        name: VAR_LINE_FILTER,
      });
      lineFiltersVariable = new AdHocFiltersVariable({
        expressionBuilder: renderLogQLLineFilter,
        name: VAR_LINE_FILTERS,
      });
      scene = new LineFilterScene({
        $variables: new SceneVariableSet({
          variables: [lineFilterVariable, lineFiltersVariable],
        }),
        caseSensitive: true,
        lineFilter: '(',
        regex: true,
      });
    });

    test('Shows error when invalid', async () => {
      render(<scene.Component model={scene} />);
      await setTimeout(() => {}, 1);
      expect(await screen.findByText('missing closing )')).toBeInTheDocument();
      const input: HTMLInputElement = await screen.findByTestId('data-testid search-logs');
      expect(input).toBeInTheDocument();
      expect(input.attributes.getNamedItem('aria-invalid')?.value).toEqual('true');
    });
  });
});
