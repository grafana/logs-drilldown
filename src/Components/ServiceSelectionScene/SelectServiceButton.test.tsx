import React from 'react';

import { render, screen, within } from '@testing-library/react';

import { AdHocFiltersVariable } from '@grafana/scenes';

import { SelectServiceButton } from './SelectServiceButton';
import { testIds } from 'services/testIds';
import * as variableGetters from 'services/variableGetters';

jest.mock('services/variableGetters', () => ({ getLabelsVariable: jest.fn() }));

describe('Service selection selectors', () => {
  afterEach(() => jest.restoreAllMocks());

  it('scopes shipped links by label name and value without ambiguous separators', () => {
    const labels = new AdHocFiltersVariable({ name: 'labels', filters: [] });
    jest.mocked(variableGetters.getLabelsVariable).mockReturnValue(labels);
    const services = [
      { labelName: 'service_name', labelValue: 'checkout' },
      { labelName: 'service_name', labelValue: 'frontend' },
      { labelName: 'a:b', labelValue: 'c' },
      { labelName: 'a', labelValue: 'b:c' },
    ];
    const models = services.map((service) => {
      const model = new SelectServiceButton(service);
      jest.spyOn(model, 'getLink').mockReturnValue('/a/grafana-lokiexplore-app/explore');
      return model;
    });
    render(
      <>
        {models.map((model) => (
          <model.Component key={model.state.labelName + model.state.labelValue} model={model} />
        ))}
      </>
    );

    for (const { labelName, labelValue } of services) {
      const scope = screen.getByTestId(testIds.index.serviceSelection(labelName, labelValue));
      expect(within(scope).getByTestId(testIds.index.selectServiceButton)).toHaveAttribute(
        'href',
        '/a/grafana-lokiexplore-app/explore'
      );
    }
  });
});
