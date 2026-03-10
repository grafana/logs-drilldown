import React, { useCallback } from 'react';

import { css, cx } from '@emotion/css';
import { Draggable, DraggableProvided, DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Box, ControlledCollapse, Icon, IconButton, Stack, Tag, useStyles2 } from '@grafana/ui';

import { useServiceSelectionContext } from './Context';
import { DefaultLabel } from 'services/api';

export function LabelList() {
  const styles = useStyles2(getLabelListStyles);
  const { currentDefaultLabels, newDefaultLabels, setNewDefaultLabels } = useServiceSelectionContext();

  const labels = newDefaultLabels ? newDefaultLabels : currentDefaultLabels;

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) {
        return;
      }
      const reordered = Array.from(labels);
      const [removed] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, removed);
      setNewDefaultLabels(reordered);
    },
    [labels, setNewDefaultLabels]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="default-labels" direction="vertical">
        {(provided) => (
          <Box ref={provided.innerRef} {...provided.droppableProps} marginBottom={2}>
            {labels.map((label, index) => (
              <Draggable key={label.label} draggableId={label.label} index={index}>
                {(provided: DraggableProvided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cx(snapshot.isDropAnimating ? styles.dropAnimating : undefined)}
                  >
                    <Stack alignItems="center">
                      <Box paddingBottom={1}>
                        <Icon
                          aria-label="Drag and drop icon"
                          title="Drag and drop to reorder"
                          name="draggabledots"
                          size="lg"
                          {...provided.dragHandleProps}
                        />
                      </Box>
                      <Label label={label} labels={labels} />
                    </Stack>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </Box>
        )}
      </Droppable>
    </DragDropContext>
  );
}

function getLabelListStyles(theme: GrafanaTheme2) {
  return {
    dropAnimating: css({
      opacity: 0.6,
    }),
  };
}

interface LabelProps {
  label: DefaultLabel;
  labels: DefaultLabel[];
}

export function Label({ label, labels }: LabelProps) {
  const { setNewDefaultLabels } = useServiceSelectionContext();
  const styles = useStyles2(getLabelStyles);

  const handleRemove = useCallback(() => {
    setNewDefaultLabels(labels.filter((currentLabel) => currentLabel.label !== label.label));
  }, [label, labels, setNewDefaultLabels]);

  const handleRemoveValue = useCallback(
    (valueToRemove: string) => {
      setNewDefaultLabels(
        labels.map((l) => (l.label === label.label ? { ...l, values: l.values.filter((v) => v !== valueToRemove) } : l))
      );
    },
    [label.label, labels, setNewDefaultLabels]
  );

  return (
    <ControlledCollapse
      label={
        <Stack alignItems="center" justifyContent="space-between">
          <div className={styles.label}>{label.label}</div>
          <IconButton
            variant="destructive"
            tooltip={`Remove ${label.label}`}
            name="trash-alt"
            size="lg"
            onClick={handleRemove}
          />
        </Stack>
      }
    >
      {!label.values.length ? (
        <Alert title="" severity="info">
          No label values selected. It will show the full list of values for this label.
        </Alert>
      ) : (
        <LabelValues label={label} onRemoveValue={handleRemoveValue} />
      )}
    </ControlledCollapse>
  );
}

interface LabelValuesProps {
  label: DefaultLabel;
  onRemoveValue: (value: string) => void;
}

function LabelValues({ label, onRemoveValue }: LabelValuesProps) {
  return (
    <Stack direction="column" gap={1}>
      <Box paddingLeft={1} maxWidth="max-content">
        {label.values.map((value) => (
          <Box key={value} paddingLeft={1} marginBottom={1}>
            <Stack alignItems="center" justifyContent="space-between">
              <Tag name={value} />
              <IconButton
                aria-label={`Remove ${value}`}
                variant="destructive"
                tooltip={`Remove ${value}`}
                name="trash-alt"
                size="sm"
                onClick={() => onRemoveValue(value)}
              />
            </Stack>
          </Box>
        ))}
      </Box>
    </Stack>
  );
}

function getLabelStyles(theme: GrafanaTheme2) {
  return {
    label: css({
      minWidth: theme.spacing(30),
    }),
  };
}
