import React, { useCallback } from 'react';

import { css, cx } from '@emotion/css';
import { Draggable, DraggableProvided, DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, Icon, IconButton, Stack, useStyles2 } from '@grafana/ui';

import { useServiceSelectionContext } from './Context';
import { getNormalizedFieldName } from 'Components/ServiceScene/LogOptionsScene';

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
          <Box
            ref={provided.innerRef}
            {...provided.droppableProps}
            backgroundColor="primary"
            borderColor="weak"
            borderStyle="solid"
            borderRadius="default"
            marginBottom={2}
            padding={2}
          >
            {labels.map((label, index) => (
              <Draggable key={label} draggableId={label} index={index}>
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
  label: string;
  labels: string[];
  provided: DraggableProvided;
  rowClassName: string;
}

export function Label({ label, labels, provided, rowClassName }: LabelProps) {
  const { setNewDefaultLabels } = useServiceSelectionContext();
  const styles = useStyles2(getLabelStyles);

  const handleRemove = useCallback(() => {
    setNewDefaultLabels(labels.filter((currentLabel) => currentLabel !== label));
  }, [label, labels, setNewDefaultLabels]);

  return (
    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={rowClassName}>
      <Stack gap={0} alignItems="center">
        <Icon
          aria-label="Drag and drop icon"
          title="Drag and drop to reorder"
          name="draggabledots"
          size="lg"
          className={styles.dragIcon}
        />
        <div className={styles.label}>{label}</div>
        <IconButton
          variant="destructive"
          tooltip={`Remove ${getNormalizedFieldName(label)}`}
          name="trash-alt"
          size="lg"
          onClick={handleRemove}
        />
      </Stack>
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
