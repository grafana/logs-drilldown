import React, { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneQueryRunner } from '@grafana/scenes';
import { Icon, InlineField, InlineSwitch, Stack, Switch, Tooltip } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../../services/analytics';
import { setFieldsPanelTypes } from '../../../services/store';
import { FieldsAggregatedBreakdownScene } from './FieldsAggregatedBreakdownScene';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { CustomConstantVariable } from 'services/CustomConstantVariable';
import { setParserEnabled, getJsonParserSegment, getLogfmtParserSegment, getParserEnabled } from 'services/parserToggle';
import { VAR_JSON_PARSER, VAR_LOGFMT_PARSER } from 'services/variables';

export function ShowFieldDisplayToggle({ model }: SceneComponentProps<FieldsAggregatedBreakdownScene>) {
  const { fieldsPanelsType } = model.useState();
  const [parsersEnabledState, setParserEnabledState] = useState(getParserEnabled());

  const toggleVolume = useCallback(() => {
    const nextPanelType = fieldsPanelsType === 'timeseries' ? 'text' : 'timeseries';
    model.setState({ fieldsPanelsType: nextPanelType });
    setFieldsPanelTypes(nextPanelType);
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.fields_panel_type_toggle,
      {
        fieldsPanelType: nextPanelType,
      }
    );
  }, [fieldsPanelsType, model]);

  const toggleParser = useCallback(() => {
    const parsersEnabled = !parsersEnabledState;

    reportAppInteraction(USER_EVENTS_PAGES.all, USER_EVENTS_ACTIONS.all.parsers_toggled, {
      enabled: parsersEnabled,
    });

    setParserEnabled(parsersEnabled);

    const jsonParserVariable = sceneGraph.lookupVariable(VAR_JSON_PARSER, model);
    const logfmtParserVariable = sceneGraph.lookupVariable(VAR_LOGFMT_PARSER, model);
    if (jsonParserVariable instanceof CustomConstantVariable) {
      const segment = getJsonParserSegment(parsersEnabled);
      jsonParserVariable.setState({ options: [{ label: segment, value: segment }], text: segment, value: segment });
    }
    if (logfmtParserVariable instanceof CustomConstantVariable) {
      const segment = getLogfmtParserSegment(parsersEnabled);
      logfmtParserVariable.setState({ options: [{ label: segment, value: segment }], text: segment, value: segment });
    }

    const indexScene = sceneGraph.getAncestor(model, IndexScene);

    // Parsed-field, JSON-path and line-format filters require a parser, so remove them when disabling
    // to avoid sending invalid queries.
    if (!parsersEnabled) {
      indexScene.clearParserDependentFilters();
    }

    // Re-run every query under the index scene so the new parser setting is applied immediately. Queries
    // built from a fixed expression (e.g. breakdown panels) are re-evaluated against the gate when rebuilt.
    sceneGraph.findDescendents(indexScene, SceneQueryRunner).forEach((queryRunner) => {
      queryRunner.runQueries();
    });

    setParserEnabledState(parsersEnabled);
  }, [model, parsersEnabledState]);

  const volumeEnabled = fieldsPanelsType === 'timeseries';

  return (
    <Stack gap={2}>
      <Stack alignItems="center">
        <Tooltip content={t(
          'components.service-scene.breakdowns.show-field-display-toggle.options.tooltip.display-volume',
          'Query time series for each field showing the distribution of values over time'
        )}>
          <label htmlFor="toggle-volume">
            {t(
              'components.service-scene.breakdowns.show-field-display-toggle.options.label.display-volume',
              'Display volume'
            )}
          </label>
        </Tooltip>
        <Switch
          value={volumeEnabled}
          onClick={toggleVolume}
          id="toggle-volume"
        />
      </Stack>

      <Stack alignItems="center">
        <Tooltip content={t(
          'components.service-scene.breakdowns.show-field-display-toggle.options.tooltip.parse-fields',
          'Enable to apply logftm/JSON parsers to every query and extract fields from the log lines'
        )}>
          <label htmlFor="toggle-parser">
            {t(
              'components.service-scene.breakdowns.show-field-display-toggle.options.label.parse-fields',
              'Extract fields'
            )}
          </label>
        </Tooltip>
        <Switch
          value={parsersEnabledState}
          onClick={toggleParser}
          id="toggle-parser"
        />
      </Stack>
    </Stack>
  );
}
