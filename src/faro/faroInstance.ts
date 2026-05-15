import type { Faro } from '@grafana/faro-web-sdk';

let faro: Faro | null = null;

export const getFaro = () => faro;

export const setFaro = (instance: Faro | null, callback?: () => void) => {
  faro = instance;
  if (callback) {
    callback();
  }
};
