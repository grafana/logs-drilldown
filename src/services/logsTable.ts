import { FieldConfig, FieldConfigSource } from '@grafana/data';
import { FieldConfigOverridesBuilder, SceneObject } from '@grafana/scenes';

import { getTableColumnWidths, saveTableColumnWidths } from './store';

/** Logs table column sizing lives under field override property `custom.width`. */
interface LogsTableFieldConfig extends FieldConfig {
  width?: number;
}

export function storeTableFieldConfig(config: FieldConfigSource, sceneRef: SceneObject) {
  const widthOverrides = config.overrides
    .filter((override) => override.matcher.id === 'byName')
    .filter((override) => override.properties.some((property) => property.id === 'custom.width' && property.value > 0))
    .map((override) => {
      const field = override.matcher.options;
      const width = override.properties.find((property) => property.id === 'custom.width' && property.value > 0)?.value;
      return {
        field,
        width,
      };
    });
  saveTableColumnWidths(sceneRef, widthOverrides);
}

export function setTableFieldOverrides(
  builder: FieldConfigOverridesBuilder<LogsTableFieldConfig>,
  sceneRef: SceneObject
) {
  const columnWidths = getTableColumnWidths(sceneRef);

  columnWidths.forEach((columnWidth) => {
    builder
      .matchFieldsWithName(columnWidth.field)
      .overrideCustomFieldConfig<LogsTableFieldConfig, 'width'>('width', columnWidth.width);
  });
}
