// Copy pasted from /grafana/grafana/packages/grafana-api-clients/src/clients/rtkq/logsdrilldown/v1alpha1/index.ts
// This is a temporary patch until the api-clients package is ready for plugin consumption
// Hopefully by the time we need to make API changes api-clients package will be more mature and we can delete everything in this api-clients directory and update imports

export { BASE_URL, API_GROUP, API_VERSION } from './baseAPI';

export * from './endpoints.gen';
