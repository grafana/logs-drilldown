import React, { memo } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObject } from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';

import { setNewRootNode } from './JSONRootNodeNavigation';
import { KeyPath } from '@gtk-grafana/react-json-tree';

const ReRootJSONButton = memo(({ keyPath, sceneRef }: { keyPath: KeyPath; sceneRef: SceneObject }) => {
  const styles = useStyles2(getStyles);
  return (
    <IconButton
      className={styles.labelButtonStyles}
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
const getStyles = (theme: GrafanaTheme2) => ({
  labelButtonStyles: css({
    color: theme.colors.text.secondary,
  }),
});

ReRootJSONButton.displayName = 'DrilldownButton';
export default ReRootJSONButton;
