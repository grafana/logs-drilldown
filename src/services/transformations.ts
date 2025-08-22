// copied from grafana/grafana/public/app/features/transformers/extractFields/types.ts
export interface ExtractFieldsOptions {
  delimiter?: string;
  format?: FieldExtractorID;
  jsonPaths?: JSONPath[];
  keepTime?: boolean;
  regExp?: string;
  replace?: boolean;
  source?: string;
}
export enum FieldExtractorID {
  JSON = 'json',
  KeyValues = 'kvp',
  Auto = 'auto',
  RegExp = 'regexp',
  Delimiter = 'delimiter',
}
export interface JSONPath {
  alias?: string;
  path: string;
}
