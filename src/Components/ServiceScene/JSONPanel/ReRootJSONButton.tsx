import { KeyPath } from '@gtk-grafana/react-json-tree';
import { IconButton } from '@grafana/ui';
import React, { memo } from 'react';

const ReRootJSONButton = memo(
  ({ keyPath, addDrilldown }: { keyPath: KeyPath; addDrilldown: (keyPath: KeyPath) => void }) => {
    return (
      <IconButton
        tooltip={`Set ${keyPath[0]} as root node`}
        onClick={(e) => {
          e.stopPropagation();
          addDrilldown(keyPath);
        }}
        size={'md'}
        name={'eye'}
        aria-label={`drilldown into ${keyPath[0]}`}
      />
    );
  }
);
ReRootJSONButton.displayName = 'DrilldownButton';
export default ReRootJSONButton;
