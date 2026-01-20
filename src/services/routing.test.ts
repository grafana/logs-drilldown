import { PageSlugs } from './enums';
import { buildDrilldownPageUrl } from './navigate';
import { buildServicesUrl, ROUTES } from './routing';

const navigateTo = (url: string) => {
  const { pathname, search } = new URL(url);
  window.history.pushState({}, '', pathname + search);
};

describe('buildBreakdownUrl', () => {
  it('generates correct url for each page slug', () => {
    navigateTo(
      'http://localhost:3000/a/grafana-lokiexplore-app/explore?var-ds=DSID&from=now-5m&to=now&patterns=%5B%5D&var-fields='
    );
    Object.keys(PageSlugs).forEach((slug) => {
      const breakdownUrl = buildDrilldownPageUrl(slug);
      expect(breakdownUrl).toBe(`${slug}?var-ds=DSID&from=now-5m&to=now&patterns=%5B%5D&var-fields=`);
    });
  });

  it('removes invalid url keys', () => {
    navigateTo(
      'http://localhost:3000/a/grafana-lokiexplore-app/explore?var-ds=DSID&from=now-5m&to=now&patterns=%5B%5D&var-fields=&notAThing=whoopsie'
    );

    Object.keys(PageSlugs).forEach((slug) => {
      const breakdownUrl = buildDrilldownPageUrl(slug);
      expect(breakdownUrl).toBe(`${slug}?var-ds=DSID&from=now-5m&to=now&patterns=%5B%5D&var-fields=`);
    });
  });

  it('preserves valid url keys', () => {
    navigateTo(
      'http://localhost:3000/a/grafana-lokiexplore-app/explore/service/tempo-distributor/logs?var-ds=DSID&from=now-5m&to=now&patterns=%5B%5D&var-fields=&var-filters=service_name%7C%3D%7Ctempo-distributor&urlColumns=%5B%22Time%22,%22Line%22%5D&visualizationType=%22table%22'
    );

    Object.keys(PageSlugs).forEach((slug) => {
      const breakdownUrl = buildDrilldownPageUrl(slug);
      expect(breakdownUrl).toBe(
        `${slug}?var-ds=DSID&from=now-5m&to=now&patterns=%5B%5D&var-fields=&var-filters=service_name%7C%3D%7Ctempo-distributor&urlColumns=%5B%22Time%22,%22Line%22%5D&visualizationType=%22table%22`
      );
    });
  });

  it('service page will remove keys from breakdown routes, but keep datasource and label filters', () => {
    navigateTo(
      'http://localhost:3000/a/grafana-lokiexplore-app/explore/service/tempo-distributor/logs?var-ds=DSID&from=now-5m&to=now&patterns=%5B%5D&var-fields=&var-filters=service_name%7C%3D%7Ctempo-distributor&urlColumns=%5B%22Time%22,%22Line%22%5D&visualizationType=%22table%22'
    );

    const breakdownUrl = buildServicesUrl(ROUTES.explore());
    expect(breakdownUrl).toBe(
      `/a/grafana-lokiexplore-app/${PageSlugs.explore}?var-ds=DSID&from=now-5m&to=now&var-filters=service_name%7C%3D%7Ctempo-distributor`
    );
  });
});
