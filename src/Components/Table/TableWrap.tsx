import React, { useCallback, useState } from 'react';

import { css } from '@emotion/css';
import { useResizeObserver } from '@react-aria/utils';

import {
  DataFrame,
  FieldType,
  FieldWithIndex,
  getTimeZone,
  guessFieldTypeFromValue,
  Labels,
  LogsSortOrder,
} from '@grafana/data';

import { useQueryContext } from 'Components/Table/Context/QueryContext';
import { LogLineState, TableColumnContextProvider } from 'Components/Table/Context/TableColumnsContext';
import { Table } from 'Components/Table/Table';
import { FieldNameMeta, FieldNameMetaStore } from 'Components/Table/TableTypes';
import { logsControlsSupported } from 'services/panel';

export type SpecialFieldsType = {
  body: FieldWithIndex;
  extraFields: FieldWithIndex[];
  time: FieldWithIndex;
};

// matches common ISO 8601
const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3,})?(?:Z|[-+]\d{2}:?\d{2})$/;

interface TableWrapProps {
  clearSelectedLine: () => void;
  logsSortOrder: LogsSortOrder;
  panelWrap: React.RefObject<HTMLDivElement | null>;
  setUrlColumns: (columns: string[]) => void;
  setUrlTableBodyState: (logLineState: LogLineState) => void;
  urlColumns: string[];
  urlTableBodyState?: LogLineState;
}

const getStyles = () => ({
  section: css({
    position: 'relative',
  }),
});

export const TableWrap = (props: TableWrapProps) => {
  const { logsFrame } = useQueryContext();

  const [panelWrapSize, setPanelWrapSize] = useState({ height: 0, width: 0 });

  // Table needs to be positioned absolutely, passing in reference wrapping panelChrome from parent
  useResizeObserver({
    onResize: () => {
      const element = props.panelWrap.current;
      if (element) {
        if (panelWrapSize.width !== element.clientWidth || panelWrapSize.height !== element.clientHeight) {
          setPanelWrapSize({
            height: element.clientHeight,
            width: element.clientWidth,
          });
        }
      }
    },
    ref: props.panelWrap,
  });

  const styles = getStyles();
  const timeZone = getTimeZone();

  // This function is called when we want to grab the column names that are currently stored in the URL.
  // So instead we have to grab the current columns directly from the URL.
  const getColumnsFromProps = useCallback(
    (fieldNames: FieldNameMetaStore) => {
      const previouslySelected = props.urlColumns;
      if (previouslySelected?.length) {
        Object.values(previouslySelected).forEach((key, index) => {
          if (fieldNames[key]) {
            fieldNames[key].active = true;
            fieldNames[key].index = index;
          }
        });
      }

      return fieldNames;
    },
    [props.urlColumns]
  );

  // If the data frame is empty, there's nothing to viz, it could mean the user has unselected all columns
  if (!logsFrame || !logsFrame.raw.length) {
    return null;
  }

  const labels = logsFrame.getLogFrameLabelsAsLabels() ?? [];
  const numberOfLogLines = logsFrame ? logsFrame.raw.length : 0;

  // If we have labels and log lines
  let pendingLabelState = mapLabelsToInitialState(logsFrame.raw, labels);
  const specialFields = {
    body: logsFrame.bodyField,
    extraFields: logsFrame.extraFields,
    time: logsFrame.timeField,
  };

  // Normalize the other fields
  if (specialFields) {
    addSpecialLabelsState(
      [specialFields.time, specialFields.body, ...specialFields.extraFields],
      pendingLabelState,
      numberOfLogLines
    );

    pendingLabelState = getColumnsFromProps(pendingLabelState);

    // Get all active columns
    const active = Object.keys(pendingLabelState).filter((key) => pendingLabelState[key].active);

    // If nothing is selected, then select the default columns
    setSpecialFieldMeta(active, specialFields, pendingLabelState);
  }

  return (
    <section className={styles.section}>
      <TableColumnContextProvider
        setUrlTableBodyState={props.setUrlTableBodyState}
        logsFrame={logsFrame}
        initialColumns={pendingLabelState}
        setUrlColumns={props.setUrlColumns}
        clearSelectedLine={props.clearSelectedLine}
        urlTableBodyState={props.urlTableBodyState}
      >
        <Table
          logsFrame={logsFrame}
          timeZone={timeZone}
          height={panelWrapSize.height - 50}
          width={panelWrapSize.width - 25 + (logsControlsSupported ? -32 : 0)}
          labels={labels}
          logsSortOrder={props.logsSortOrder}
        />
      </TableColumnContextProvider>
    </section>
  );
};

const normalize = (value: number, total: number): number => {
  return Math.ceil((100 * value) / total);
};

type labelName = string;
type labelValue = string;

export function getCardinalityMapFromLabels(labels: Labels[]) {
  const cardinalityMap = new Map<labelName, { maxLength: number; valueSet: Set<labelValue> }>();
  labels.forEach((fieldLabels) => {
    const labelNames = Object.keys(fieldLabels);
    labelNames.forEach((labelName) => {
      if (cardinalityMap.has(labelName)) {
        const setObj = cardinalityMap.get(labelName);
        const values = setObj?.valueSet;
        const maxLength = setObj?.maxLength;

        if (values && !values?.has(fieldLabels[labelName])) {
          values?.add(fieldLabels[labelName]);
          if (maxLength && fieldLabels[labelName].length > maxLength) {
            cardinalityMap.set(labelName, { maxLength: fieldLabels[labelName].length, valueSet: values });
          }
        }
      } else {
        cardinalityMap.set(labelName, {
          maxLength: fieldLabels[labelName].length,
          valueSet: new Set([fieldLabels[labelName]]),
        });
      }
    });
  });

  return cardinalityMap;
}

/**
 * Guess the field type of the value
 * @param value
 */
export function guessLogsFieldTypeForValue(value: string) {
  let fieldType = guessFieldTypeFromValue(value);
  const isISO8601 = fieldType === 'string' && iso8601Regex.test(value);
  if (isISO8601) {
    fieldType = FieldType.time;
  }
  return fieldType;
}

function mapLabelsToInitialState(dataFrame: DataFrame, labels: Labels[]) {
  let pendingLabelState: FieldNameMetaStore = {};

  // Use a map to dedupe labels and count their occurrences in the logs
  const labelMap = new Map<string, FieldNameMeta>();
  const cardinality = getCardinalityMapFromLabels(labels);
  const numberOfLogLines = dataFrame ? dataFrame.length : 0;

  if (labels?.length && numberOfLogLines) {
    // Iterate through all of Labels
    labels.forEach((labels: Labels) => {
      const labelsArray = Object.keys(labels);
      // Iterate through the label values
      labelsArray.forEach((label) => {
        const cardinalityMap = cardinality.get(label);
        const cardinalityCount = cardinalityMap?.valueSet?.size ?? 0;
        // If it's already in our map, increment the count
        if (labelMap.has(label)) {
          const value = labelMap.get(label);

          if (value) {
            if (value?.active) {
              labelMap.set(label, {
                active: true,
                cardinality: cardinalityCount,
                index: value.index,
                maxLength: cardinalityMap?.maxLength,
                percentOfLinesWithLabel: value.percentOfLinesWithLabel + 1,
              });
            } else {
              labelMap.set(label, {
                active: false,
                cardinality: cardinalityCount,
                index: undefined,
                maxLength: cardinalityMap?.maxLength,
                percentOfLinesWithLabel: value.percentOfLinesWithLabel + 1,
              });
            }
          }
          // Otherwise add it
        } else {
          labelMap.set(label, {
            active: false,
            cardinality: cardinalityCount,
            index: undefined,
            maxLength: cardinalityMap?.maxLength,
            percentOfLinesWithLabel: 1,
          });
        }
      });
    });

    // Converting the map to an object
    pendingLabelState = Object.fromEntries(labelMap);

    // Convert count to percent of log lines
    Object.keys(pendingLabelState).forEach((key) => {
      pendingLabelState[key].percentOfLinesWithLabel = normalize(
        pendingLabelState[key].percentOfLinesWithLabel,
        numberOfLogLines
      );
    });
  }
  return pendingLabelState;
}

/**
 * Add special fields like time and body
 * @param specialFieldArray
 * @param pendingLabelState
 * @param numberOfLogLines
 */
function addSpecialLabelsState(
  specialFieldArray: Array<FieldWithIndex | undefined>,
  pendingLabelState: FieldNameMetaStore,
  numberOfLogLines: number
) {
  specialFieldArray.forEach((field) => {
    if (!field) {
      return;
    }
    const isActive = pendingLabelState[field.name]?.active;
    const index = pendingLabelState[field.name]?.index;
    if (isActive && index !== undefined) {
      pendingLabelState[field.name] = {
        active: true,
        cardinality: numberOfLogLines,
        index: index,
        percentOfLinesWithLabel: normalize(
          field.values.filter((value) => value !== null && value !== undefined).length,
          numberOfLogLines
        ),
      };
    } else {
      pendingLabelState[field.name] = {
        active: false,
        cardinality: numberOfLogLines,
        index: undefined,
        percentOfLinesWithLabel: normalize(
          field.values.filter((value) => value !== null && value !== undefined).length,
          numberOfLogLines
        ),
      };
    }
  });

  return pendingLabelState;
}

function setSpecialFieldMeta(
  active: string[],
  specialFields: SpecialFieldsType,
  pendingLabelState: FieldNameMetaStore
) {
  // If no fields are visible, set defaults
  if (active.length === 0) {
    if (specialFields.body?.name) {
      pendingLabelState[specialFields.body?.name].active = true;
      pendingLabelState[specialFields.body?.name].index = 1;
    }
    if (specialFields.time?.name) {
      pendingLabelState[specialFields.time?.name].active = true;
      pendingLabelState[specialFields.time?.name].index = 0;
    }
  }

  if (specialFields.time?.name && specialFields.body?.name) {
    pendingLabelState[specialFields.body?.name].type = 'BODY_FIELD';
    pendingLabelState[specialFields.time?.name].type = 'TIME_FIELD';
  }

  if (specialFields.extraFields.length) {
    specialFields.extraFields.forEach((field) => {
      const hasLinks = field.config.links?.length;
      if (hasLinks) {
        pendingLabelState[field.name].type = 'LINK_FIELD';
      }
    });
  }
}
