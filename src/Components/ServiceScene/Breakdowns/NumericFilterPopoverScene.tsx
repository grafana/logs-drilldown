import React, { useEffect, useState } from 'react';

import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, Combobox, ComboboxOption, Field, FieldSet, Input, Label, Stack, useStyles2 } from '@grafana/ui';

import {
  addNumericFilter,
  InterpolatedFilterType,
  removeNumericFilter,
  validateVariableNameForField,
} from './AddToFiltersButton';
import { SelectLabelActionScene } from './SelectLabelActionScene';
import { FilterOp } from 'services/filterTypes';
import { logger } from 'services/logger';
import { testIds } from 'services/testIds';
import { getAdHocFiltersVariable, getValueFromFieldsFilter } from 'services/variableGetters';

type ComparisonOperatorTypes = 'bytes' | 'duration' | 'float' | 'int';

export interface NumericFilterPopoverSceneState extends SceneObjectState {
  fieldType: ComparisonOperatorTypes;
  gt?: number;
  gte?: boolean;
  hasExistingFilter?: boolean;
  labelName: string;
  lt?: number;
  lte?: boolean;
  variableType: InterpolatedFilterType;
}

export type NumericFilterPopoverSceneStateTotal =
  | (NumericFilterPopoverSceneState & FloatTypes)
  | (NumericFilterPopoverSceneState & IntTypes)
  | (NumericFilterPopoverSceneState & DurationTypes)
  | (NumericFilterPopoverSceneState & ByteTypes);

enum DisplayDurationUnits {
  ns = 'ns',
  us = 'µs',
  ms = 'ms',
  s = 's',
  m = 'm',
  h = 'h',
}

export const validDurationValues: { [key in DisplayDurationUnits]: string[] } = {
  [DisplayDurationUnits.ns]: ['ns'],
  [DisplayDurationUnits.us]: ['µs', 'us'],
  [DisplayDurationUnits.ms]: ['ms'],
  [DisplayDurationUnits.s]: ['s'],
  [DisplayDurationUnits.m]: ['m'],
  [DisplayDurationUnits.h]: ['h'],
};

enum DisplayByteUnits {
  B = 'B',
  KB = 'KB',
  MB = 'MB',
  GB = 'GB',
  TB = 'TB',
}

export enum ValidByteUnitValues {
  B = 'B',
  KB = 'KB',
  MB = 'MB',
  GB = 'GB',
  TB = 'TB',

  // Not selectable in the UI, but valid from link extensions
  kB = 'kB',
  KiB = 'KiB',
  MiB = 'MiB',
  GiB = 'GiB',
  TiB = 'TiB',
}

interface FloatUnitTypes {
  gtu: '';
  ltu: '';
}

interface FloatTypes extends FloatUnitTypes {
  fieldType: 'float';
}

interface IntTypes extends FloatUnitTypes {
  fieldType: 'int';
}

interface DurationUnitTypes {
  gtu: DisplayDurationUnits;
  ltu: DisplayDurationUnits;
}

interface DurationTypes extends DurationUnitTypes {
  fieldType: 'duration';
}

interface ByteUnitTypes {
  gtu: DisplayByteUnits;
  ltu: DisplayByteUnits;
}

interface ByteTypes extends ByteUnitTypes {
  fieldType: 'bytes';
}

/**
 * Combobox option menus from @grafana/ui often portal to document.body / #grafana-portal-container.
 * Those clicks are outside our card body for contains(), but must not close the numeric popover.
 */
function isEventTargetInsideGrafanaComboboxMenu(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return (
    target.closest('[role="listbox"]') != null ||
    target.closest('[role="option"]') != null ||
    target.closest('[data-testid="combobox-option-group"]') != null
  );
}

export class NumericFilterPopoverScene extends SceneObjectBase<NumericFilterPopoverSceneStateTotal> {
  constructor(state: Omit<NumericFilterPopoverSceneStateTotal, 'gtu' | 'ltu'>) {
    let units: FloatUnitTypes | DurationUnitTypes | ByteUnitTypes;
    const fieldType: ComparisonOperatorTypes = state.fieldType;
    if (fieldType === 'bytes') {
      units = { gtu: DisplayByteUnits.B, ltu: DisplayByteUnits.B };
    } else if (fieldType === 'duration') {
      units = { gtu: DisplayDurationUnits.s, ltu: DisplayDurationUnits.s };
    } else if (fieldType === 'float' || fieldType === 'int') {
      units = { gtu: '', ltu: '' };
    } else {
      throw new Error(`field type incorrectly defined: ${fieldType}`);
    }

    // @todo - how to avoid type assertion?
    super({ ...state, ...units } as NumericFilterPopoverSceneStateTotal);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    // get existing values if they exist
    const variable = getAdHocFiltersVariable(
      validateVariableNameForField(this.state.labelName, this.state.variableType),
      this
    );
    const filters = variable.state.filters.filter((f) => f.key === this.state.labelName);
    const gtFilter = filters.find((f) => f.operator === FilterOp.gte || f.operator === FilterOp.gt);
    const ltFilter = filters.find((f) => f.operator === FilterOp.lte || f.operator === FilterOp.lt);
    let stateUpdate: Partial<NumericFilterPopoverSceneStateTotal> = {};

    if (this.state.fieldType === 'duration' || this.state.fieldType === 'bytes') {
      if (gtFilter) {
        const extractedValue = extractValueFromString(getValueFromFieldsFilter(gtFilter).value, this.state.fieldType);

        if (extractedValue) {
          stateUpdate.gt = extractedValue.value;
          stateUpdate.gtu = extractedValue.unit;
          stateUpdate.gte = gtFilter.operator === FilterOp.gte;
        }
      }

      if (ltFilter) {
        const extractedValue = extractValueFromString(getValueFromFieldsFilter(ltFilter).value, this.state.fieldType);

        if (extractedValue) {
          stateUpdate.lt = extractedValue.value;
          stateUpdate.ltu = extractedValue.unit;
          stateUpdate.lte = ltFilter.operator === FilterOp.lte;
        }
      }
    } else {
      // Floats/int have no unit
      if (gtFilter) {
        const extractedValue = getValueFromFieldsFilter(gtFilter).value;
        stateUpdate.gt = Number(extractedValue);
        stateUpdate.gtu = '';
        stateUpdate.gte = gtFilter.operator === FilterOp.gte;
      }
      if (ltFilter) {
        const extractedValue = getValueFromFieldsFilter(ltFilter).value;
        stateUpdate.lt = Number(extractedValue);
        stateUpdate.ltu = '';
        stateUpdate.lte = ltFilter.operator === FilterOp.lte;
      }
    }

    if (Object.keys(stateUpdate).length !== 0) {
      stateUpdate.hasExistingFilter = true;
    }

    this.setState(stateUpdate);
  }

  onSubmit() {
    // "0" values break byte queries see https://github.com/grafana/loki/issues/14993, for now we remove the filter when a 0 value is entered to prevent breakage
    // numeric values can only be fields or metadata variable
    if (this.state.gt) {
      addNumericFilter(
        this.state.labelName,
        this.state.gt.toString() + this.state.gtu,
        this.state.gte ? FilterOp.gte : FilterOp.gt,
        this,
        this.state.variableType
      );
    } else {
      removeNumericFilter(
        this.state.labelName,
        this,
        this.state.gte ? FilterOp.gte : FilterOp.gt,
        this.state.variableType
      );
    }

    if (this.state.lt) {
      addNumericFilter(
        this.state.labelName,
        this.state.lt.toString() + this.state.ltu,
        this.state.lte ? FilterOp.lte : FilterOp.lt,
        this,
        this.state.variableType
      );
    } else {
      removeNumericFilter(
        this.state.labelName,
        this,
        this.state.lte ? FilterOp.lte : FilterOp.lt,
        this.state.variableType
      );
    }

    const selectLabelActionScene = sceneGraph.getAncestor(this, SelectLabelActionScene);
    selectLabelActionScene.togglePopover();
  }
  onInputKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const formDisabled = this.state.gt === undefined && this.state.lt === undefined;
    if (e.key === 'Enter' && !formDisabled) {
      this.onSubmit();
    }
  };

  public static Component = ({ model }: SceneComponentProps<NumericFilterPopoverScene>) => {
    const popoverStyles = useStyles2(getPopoverStyles);
    const { fieldType, gt, gte, gtu, hasExistingFilter, labelName, lt, lte, ltu } = model.useState();
    const subTitle =
      fieldType !== 'float' && fieldType !== 'int' && fieldType !== labelName ? `(${fieldType})` : undefined;

    const selectLabelActionScene = sceneGraph.getAncestor(model, SelectLabelActionScene);
    const formDisabled = gt === undefined && lt === undefined;
    // Combobox menus render in a Portal
    const [comboboxMenuContainer, setComboboxMenuContainer] = useState<HTMLDivElement | null>(null);

    // Close the parent popover on document clicks replaces ClickOutsideWrapper
    useEffect(() => {
      if (!comboboxMenuContainer) {
        return;
      }
      const onDocumentClick = (event: MouseEvent) => {
        if (!(event.target instanceof Node)) {
          return;
        }
        // Skip close when the click is on the filter button group
        if (event.target instanceof Element) {
          if (event.target.closest(`[data-testid="${testIds.breakdowns.common.filterButtonGroup}"]`)) {
            return;
          }
        }
        // Skip close when the click is on Grafana Combobox
        if (isEventTargetInsideGrafanaComboboxMenu(event.target)) {
          return;
        }
        if (!comboboxMenuContainer.contains(event.target)) {
          selectLabelActionScene.togglePopover();
        }
      };
      document.addEventListener('click', onDocumentClick, false);

      return () => {
        document.removeEventListener('click', onDocumentClick, false);
      };
    }, [comboboxMenuContainer, selectLabelActionScene]);

    const comboboxPortalProps = { portalContainer: comboboxMenuContainer ?? undefined };

    return (
      <Stack direction="column" gap={0} role="tooltip">
        <div ref={setComboboxMenuContainer} className={popoverStyles.card.body}>
          <div className={popoverStyles.card.title}>
            {labelName} {subTitle}
          </div>

          <div className={popoverStyles.card.fieldWrap}>
            {/* greater than */}
            <FieldSet className={popoverStyles.card.fieldset}>
              <Field
                data-testid={testIds.breakdowns.common.filterNumericPopover.inputGreaterThanInclusive}
                horizontal={true}
                className={cx(popoverStyles.card.field, popoverStyles.card.inclusiveField)}
              >
                <Combobox<string>
                  {...comboboxPortalProps}
                  value={gte !== undefined ? gte.toString() : 'false'}
                  options={[
                    {
                      label: t(
                        'components.service-scene.breakdowns.numeric-filter-popover-scene.label.greater-than',
                        'Greater than'
                      ),
                      value: 'false',
                    },
                    {
                      label: t(
                        'components.service-scene.breakdowns.numeric-filter-popover-scene.label.greater-than-or-equal',
                        'Greater than or equal'
                      ),
                      value: 'true',
                    },
                  ]}
                  onChange={(value) => model.setState({ gte: value.value === 'true' })}
                  width="auto"
                  minWidth={17}
                />
              </Field>
              <Field
                data-testid={testIds.breakdowns.common.filterNumericPopover.inputGreaterThan}
                horizontal={true}
                className={popoverStyles.card.field}
              >
                <Input
                  onKeyDownCapture={model.onInputKeydown}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus={true}
                  onChange={(e) => {
                    model.setState({
                      gt: e.currentTarget.value !== '' ? Number(e.currentTarget.value) : undefined,
                    });
                  }}
                  className={popoverStyles.card.numberInput}
                  value={gt}
                  type={'number'}
                />
              </Field>
              {fieldType !== 'float' && fieldType !== 'int' && (
                <Label>
                  <Field
                    data-testid={testIds.breakdowns.common.filterNumericPopover.inputGreaterThanUnit}
                    horizontal={true}
                    className={popoverStyles.card.field}
                    label={
                      <span className={popoverStyles.card.unitFieldLabel}>
                        <Trans i18nKey="components.service-scene.breakdowns.numeric-filter-popover-scene.unit">
                          Unit
                        </Trans>
                      </span>
                    }
                  >
                    <Combobox<DisplayDurationUnits | DisplayByteUnits>
                      {...comboboxPortalProps}
                      onChange={(e) => {
                        model.setState({
                          gtu: e.value,
                        });
                      }}
                      options={getUnitOptions(fieldType)}
                      value={gtu}
                      width="auto"
                      minWidth={8}
                    />
                  </Field>
                </Label>
              )}
            </FieldSet>

            {/* less than */}
            <FieldSet className={popoverStyles.card.fieldset}>
              <Field
                data-testid={testIds.breakdowns.common.filterNumericPopover.inputLessThanInclusive}
                horizontal={true}
                className={cx(popoverStyles.card.field, popoverStyles.card.inclusiveField)}
              >
                <Combobox<string>
                  {...comboboxPortalProps}
                  value={lte !== undefined ? lte.toString() : 'false'}
                  options={[
                    {
                      label: t(
                        'components.service-scene.breakdowns.numeric-filter-popover-scene.label.less-than',
                        'Less than'
                      ),
                      value: 'false',
                    },
                    {
                      label: t(
                        'components.service-scene.breakdowns.numeric-filter-popover-scene.label.less-than-or-equal',
                        'Less than or equal'
                      ),
                      value: 'true',
                    },
                  ]}
                  onChange={(value) => model.setState({ lte: value.value === 'true' })}
                  width="auto"
                  minWidth={17}
                />
              </Field>
              <Field
                data-testid={testIds.breakdowns.common.filterNumericPopover.inputLessThan}
                horizontal={true}
                className={popoverStyles.card.field}
              >
                <Input
                  onKeyDownCapture={model.onInputKeydown}
                  onChange={(e) =>
                    model.setState({ lt: e.currentTarget.value !== '' ? Number(e.currentTarget.value) : undefined })
                  }
                  className={popoverStyles.card.numberInput}
                  value={lt}
                  type={'number'}
                />
              </Field>
              {fieldType !== 'float' && fieldType !== 'int' && (
                <Label>
                  <Field
                    data-testid={testIds.breakdowns.common.filterNumericPopover.inputLessThanUnit}
                    horizontal={true}
                    className={popoverStyles.card.field}
                    label={
                      <span className={popoverStyles.card.unitFieldLabel}>
                        <Trans i18nKey="components.service-scene.breakdowns.numeric-filter-popover-scene.unit">
                          Unit
                        </Trans>
                      </span>
                    }
                  >
                    <Combobox<DisplayDurationUnits | DisplayByteUnits>
                      {...comboboxPortalProps}
                      onChange={(e) => {
                        model.setState({
                          ltu: e.value,
                        });
                      }}
                      options={getUnitOptions(fieldType)}
                      value={ltu}
                      width="auto"
                      minWidth={8}
                    />
                  </Field>
                </Label>
              )}
            </FieldSet>
          </div>

          {/* buttons */}
          <div className={popoverStyles.card.buttons}>
            {hasExistingFilter && (
              <Button
                data-testid={testIds.breakdowns.common.filterNumericPopover.removeButton}
                disabled={!hasExistingFilter}
                onClick={() => {
                  model.setState({
                    gt: undefined,
                    lt: undefined,
                  });
                  model.onSubmit();
                }}
                size={'sm'}
                variant={'destructive'}
                fill={'outline'}
              >
                <Trans i18nKey="components.service-scene.breakdowns.numeric-filter-popover-scene.remove">Remove</Trans>
              </Button>
            )}
            <Button
              data-testid={testIds.breakdowns.common.filterNumericPopover.submitButton}
              disabled={formDisabled}
              onClick={() => model.onSubmit()}
              size={'sm'}
              variant={'primary'}
              fill={'outline'}
              type={'submit'}
            >
              <Trans i18nKey="components.service-scene.breakdowns.numeric-filter-popover-scene.add">Add</Trans>
            </Button>

            <Button
              data-testid={testIds.breakdowns.common.filterNumericPopover.cancelButton}
              onClick={() => selectLabelActionScene.togglePopover()}
              size={'sm'}
              variant={'secondary'}
              fill={'outline'}
            >
              <Trans i18nKey="components.service-scene.breakdowns.numeric-filter-popover-scene.cancel">Cancel</Trans>
            </Button>
          </div>
        </div>
      </Stack>
    );
  };
}

export function extractValueFromString(
  inputString: string,
  inputType: 'bytes' | 'duration'
): { unit: DisplayByteUnits | DisplayDurationUnits; value: number } | undefined {
  if (inputType === 'duration') {
    const durationValues = Object.values(DisplayDurationUnits);

    // Check the end of the filter value for a unit that exactly matches
    const durationValue = durationValues.find((durationValue) => {
      const durationValueLength = durationValue.length;
      return inputString.slice(durationValueLength * -1) === durationValue;
    });

    if (durationValue) {
      const value = Number(inputString.replace(durationValue, ''));
      if (!isNaN(value)) {
        return {
          unit: durationValue,
          value: value,
        };
      }
    }
  }

  if (inputType === 'bytes') {
    const bytesValues = Object.values(DisplayByteUnits)
      // must be sorted from longest to shortest
      .sort((a, b) => b.length - a.length);

    // Check the end of the filter value for a unit that exactly matches
    const bytesValue = bytesValues.find((bytesValue) => {
      const byteValueLength = bytesValue.length;
      return inputString.slice(byteValueLength * -1) === bytesValue;
    });

    if (bytesValue) {
      const value = Number(inputString.replace(bytesValue, ''));
      if (!isNaN(value)) {
        return {
          unit: bytesValue,
          value: value,
        };
      }
    }
  }

  return undefined;
}

function getUnitOptions(
  fieldType: 'bytes' | 'duration'
): Array<ComboboxOption<DisplayDurationUnits | DisplayByteUnits>> {
  if (fieldType === 'duration') {
    const keys = Object.keys(DisplayDurationUnits) as Array<keyof typeof DisplayDurationUnits>;
    return keys.map((key) => {
      return {
        label: key,
        value: DisplayDurationUnits[key],
      };
    });
  }

  if (fieldType === 'bytes') {
    const keys = Object.keys(DisplayByteUnits) as Array<keyof typeof DisplayByteUnits>;
    return keys.map((key) => {
      return {
        label: key,
        value: DisplayByteUnits[key],
      };
    });
  }

  const error = new Error(`invalid field type: ${fieldType}`);
  logger.error(error, { msg: 'getUnitOptions, invalid field type' });
  throw error;
}

const getPopoverStyles = (theme: GrafanaTheme2) => ({
  card: {
    body: css({
      padding: theme.spacing(2),
    }),
    buttons: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1.5),
      justifyContent: 'flex-end',
      marginTop: theme.spacing(1),
    }),
    field: css({
      alignItems: 'center',
      display: 'flex',
      marginBottom: theme.spacing(1),
    }),
    fieldset: css({
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 0,
      width: '100%',
    }),
    fieldWrap: css({
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: 0,
      paddingTop: theme.spacing(2),
    }),
    inclusiveField: css({
      marginRight: theme.spacing(1),
    }),
    inclusiveInput: css({
      minWidth: '185px',
    }),
    numberFieldLabel: css({
      width: '100px',
    }),
    numberInput: css({
      width: '75px',
    }),
    p: css({
      maxWidth: 300,
    }),
    selectInput: css({
      minWidth: '65px',
    }),
    switchFieldLabel: css({
      marginLeft: theme.spacing(2),
      marginRight: theme.spacing(1),
    }),
    title: css({}),
    unitFieldLabel: css({
      marginLeft: theme.spacing(2),
      marginRight: theme.spacing(1.5),
    }),
  },
});
