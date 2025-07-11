import React, { memo } from 'react';

import { SceneObject } from '@grafana/scenes';
import { IconButton } from '@grafana/ui';

import { labelButtonStyles } from '../../../services/JSONViz';
import { setNewRootNode } from './JsonRootNodeNavigation';
import { KeyPath } from '@gtk-grafana/react-json-tree';

const ReRootJSONButton = memo(({ keyPath, sceneRef }: { keyPath: KeyPath; sceneRef: SceneObject }) => {
  return (
    <IconButton
      className={labelButtonStyles}
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
