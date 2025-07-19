import React, { memo } from 'react';

import { SceneObject } from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';

import { getJSONFilterButtonStyles } from './JSONNestedNodeFilterButton';
import { setNewRootNode } from './JSONRootNodeNavigation';
import { KeyPath } from '@gtk-grafana/react-json-tree';

const ReRootJSONButton = memo(({ keyPath, sceneRef }: { keyPath: KeyPath; sceneRef: SceneObject }) => {
  const styles = useStyles2(getJSONFilterButtonStyles, false);
  return (
    <IconButton
      className={styles.button}
      tooltip={`Set ${keyPath[0]} as root node`}
      onClick={(e) => {
        e.stopPropagation();
        setNewRootNode(keyPath, sceneRef);
      }}
      size={'md'}
      name={'eye'}
      aria-label={`drilldown into ${keyPath[0]}`}
    />
  );
});

ReRootJSONButton.displayName = 'DrilldownButton';
export default ReRootJSONButton;
