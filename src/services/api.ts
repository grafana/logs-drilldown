import { logger } from './logger';
import { LogsDrilldownDefaultLabelsList } from 'lib/api-clients/logsdrilldown/v1beta1';
import { getAPIBaseURL } from 'lib/api-clients/utils/utils';

export type DefaultLabelsSettings = Record<string, string[]>;

export async function getDefaultLabelSettings(): Promise<DefaultLabelsSettings | null> {
  const baseUrl = getAPIBaseURL('logsdrilldown.grafana.app', 'v1beta1');

  try {
    const request: Request = new Request(`${baseUrl}/logsdrilldowndefaultlabels`);
    const fetchResult = await fetch(request);

    if (fetchResult.ok) {
      // @todo refactor fetch once https://github.com/grafana/grafana-community-team/issues/633 is merged
      const response = (await fetchResult.json()) as LogsDrilldownDefaultLabelsList;
      const settings: DefaultLabelsSettings = {};

      if (response.items) {
        response.items.forEach((item) => {
          if (item.metadata.name && item.spec.records?.[0]?.labels?.length) {
            settings[item.metadata.name] = item.spec.records[0].labels;
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
