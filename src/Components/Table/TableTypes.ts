import { FieldType } from '@grafana/data';

export type InactiveFieldMeta = {
  active: false;
  index: undefined; // if undefined the column is not selected
};

export type ActiveFieldMeta = {
  active: true;
  index: number; // if undefined the column is not selected
};

export const BODY_FIELD = 'BODY_FIELD';
export const LINK_FIELD = 'LINK_FIELD';
export const TIME_FIELD = 'TIME_FIELD';

export type GenericMeta = {
  cardinality: number;
  fieldType?: FieldType;
  maxLength?: number;
  percentOfLinesWithLabel: number;
  type?: typeof BODY_FIELD | typeof LINK_FIELD | typeof TIME_FIELD;
};

export type FieldNameMeta = (ActiveFieldMeta | InactiveFieldMeta) & GenericMeta;

export type FieldName = string;
export type FieldNameMetaStore = Record<FieldName, FieldNameMeta>;
