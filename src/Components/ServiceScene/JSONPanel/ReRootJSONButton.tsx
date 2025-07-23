import React, { memo, useMemo } from 'react';

import { SceneObject } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { ImgButton } from '../../UI/ImgButton';
import { getJSONFilterButtonStyles } from './JSONNestedNodeFilterButton';
import { setNewRootNode } from './JSONRootNodeNavigation';
import { KeyPath } from '@gtk-grafana/react-json-tree';

const ReRootJSONButton = memo(({ keyPath, sceneRef }: { keyPath: KeyPath; sceneRef: SceneObject }) => {
  const styles = useStyles2(getJSONFilterButtonStyles, false);
  return useMemo(
    () => (
      <ImgButton
        className={styles.button}
        tooltip={`Set ${keyPath[0]} as root node`}
        onClick={(e) => {
          e.stopPropagation();
          setNewRootNode(keyPath, sceneRef);
        }}
        name={'eye'}
        aria-label={`drilldown into ${keyPath[0]}`}
      />
    ),
    [keyPath, sceneRef, styles.button]
  );
});

ReRootJSONButton.displayName = 'DrilldownButton';
export default ReRootJSONButton;
