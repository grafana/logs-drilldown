export const EMBEDDED_URL_PARAM_NAMESPACE = 'ld';
export function getNamespaceKey(embedded: boolean, name: string) {
  return embedded ? `${EMBEDDED_URL_PARAM_NAMESPACE}-${name}` : name;
}
