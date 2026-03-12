import { getAPIBaseURL } from '@grafana/api-clients';
import { LogsDrilldownDefaultLabelsList } from '@grafana/api-clients/rtkq/logsdrilldown/v1beta1';

import { logger } from './logger';

export type DefaultLabel = {
  label: string;
  values: string[];
};

export type DefaultLabelsSettings = Record<string, DefaultLabel[]>;

export async function getDefaultLabelSettings(): Promise<DefaultLabelsSettings | null> {
  const baseUrl = getAPIBaseURL('logsdrilldown.grafana.app', 'v1beta1');

  try {
    const request: Request = new Request(`${baseUrl}/logsdrilldowndefaultlabels`);
    const fetchResult = await fetch(request);

    if (fetchResult.ok) {
      const response = (await fetchResult.json()) as LogsDrilldownDefaultLabelsList;
      const settings: DefaultLabelsSettings = {};

      if (response.items) {
        response.items.forEach((item) => {
          if (item.metadata.name && item.spec.records) {
            settings[item.metadata.name] = item.spec.records;
          }
        });
      }

      return settings;
    }
  } catch (e) {
    logger.error(e);
  }
  return null;
}
