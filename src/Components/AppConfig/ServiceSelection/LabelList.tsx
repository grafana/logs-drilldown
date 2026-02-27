import React, { useCallback } from 'react';

import { css, cx } from '@emotion/css';
import { Draggable, DraggableProvided, DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Box, ControlledCollapse, Icon, IconButton, Stack, useStyles2 } from '@grafana/ui';

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
                {(draggableProvided: DraggableProvided, snapshot) => (
                  <Label
                    label={label}
                    labels={labels}
                    provided={draggableProvided}
                    rowClassName={cx(snapshot.isDropAnimating ? styles.dropAnimating : undefined)}
                  />
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
  provided: DraggableProvided;
  rowClassName: string;
}

export function Label({ label, labels, provided, rowClassName }: LabelProps) {
  const { setNewDefaultLabels } = useServiceSelectionContext();
  const styles = useStyles2(getLabelStyles);

  const handleRemove = useCallback(() => {
    setNewDefaultLabels(labels.filter((currentLabel) => currentLabel.label !== label.label));
  }, [label, labels, setNewDefaultLabels]);

  return (
    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={rowClassName}>
      <ControlledCollapse
        label={
          <Stack alignItems="center" justifyContent="space-between">
            <div className={styles.label}>{label.label}</div>
            <Icon
              aria-label="Drag and drop icon"
              title="Drag and drop to reorder"
              name="draggabledots"
              size="lg"
              className={styles.dragIcon}
            />
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
        {!label.values.length && (
          <Alert title="" severity="info">
            No label values selected. It will show the full list of values for this label..
          </Alert>
        )}
      </ControlledCollapse>
    </div>
  );
}

function getLabelStyles(theme: GrafanaTheme2) {
  return {
    label: css({
      minWidth: theme.spacing(30),
    }),
    dragIcon: css({
      cursor: 'drag',
      opacity: 0.4,
      marginRight: theme.spacing(1),
    }),
  };
}
