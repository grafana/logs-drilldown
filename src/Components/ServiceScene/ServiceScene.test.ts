import { locationService } from '@grafana/runtime';
import { AdHocFiltersVariable, AdHocFilterWithLabels, SceneVariableSet } from '@grafana/scenes';

import { ServiceScene } from './ServiceScene';
import { FilterOp, FilterOpType } from 'services/filterTypes';
import {
  addAdHocFilterUserInputPrefix,
  ALL_VARIABLE_VALUE,
  EMPTY_VARIABLE_VALUE,
  SERVICE_NAME,
  VAR_LABELS,
} from 'services/variables';

const EMPTY = 'empty';
const PRIMARY_LABEL_REMOVED = 'primary_label_removed';

function labelFilter(key: string, operator: FilterOpType, value = ''): AdHocFilterWithLabels {
  return { key, operator, value };
}

function setRoute(labelName: string, labelValue: string) {
  locationService.push(`/a/grafana-lokiexplore-app/explore/${labelName}/${encodeURIComponent(labelValue)}/logs`);
}

describe('ServiceScene.getLabelFiltersStatus', () => {
  let scene: ServiceScene;

  beforeEach(() => {
    scene = new ServiceScene({});
    setRoute('service', 'tempo-ingester');
  });

  test('returns empty when there are no label filters', () => {
    expect(scene.getLabelFiltersStatus([])).toEqual({ isValid: false, reason: EMPTY });
  });

  test('stays valid when the route label is an inclusive service_name filter', () => {
    expect(scene.getLabelFiltersStatus([labelFilter(SERVICE_NAME, FilterOp.Equal, 'tempo-ingester')])).toEqual({
      isValid: true,
    });
  });

  test('stays valid for a regex service_name filter and extra filters', () => {
    expect(
      scene.getLabelFiltersStatus([
        labelFilter(SERVICE_NAME, FilterOp.RegexEqual, 'tempo-ingester'),
        labelFilter('cluster', FilterOp.Equal, 'eu-west-1'),
      ])
    ).toEqual({ isValid: true });
  });

  test('stays valid when the URL slug is service_name', () => {
    setRoute(SERVICE_NAME, 'tempo-ingester');

    expect(scene.getLabelFiltersStatus([labelFilter(SERVICE_NAME, FilterOp.Equal, 'tempo-ingester')])).toEqual({
      isValid: true,
    });
  });

  test('stays valid when the filter key matches the route label', () => {
    setRoute('cluster', 'eu-west-1');

    expect(scene.getLabelFiltersStatus([labelFilter('cluster', FilterOp.Equal, 'eu-west-1')])).toEqual({
      isValid: true,
    });
  });

  test('stays valid when a regex value matches the encoded route slug', () => {
    setRoute('cluster', 'us-.+');

    expect(scene.getLabelFiltersStatus([labelFilter('cluster', FilterOp.RegexEqual, 'us-.+')])).toEqual({
      isValid: true,
    });
  });

  test('stays valid when slashes in the filter value were normalized in the route', () => {
    setRoute('service', 'tempo-ingester');

    expect(scene.getLabelFiltersStatus([labelFilter(SERVICE_NAME, FilterOp.Equal, 'tempo/ingester')])).toEqual({
      isValid: true,
    });
  });

  test('stays valid when the filter value has the user-input prefix', () => {
    expect(
      scene.getLabelFiltersStatus([
        labelFilter(SERVICE_NAME, FilterOp.Equal, addAdHocFilterUserInputPrefix('tempo-ingester')),
      ])
    ).toEqual({ isValid: true });
  });

  test('promotes the remaining inclusive filter when the route label is gone', () => {
    const cluster = labelFilter('cluster', FilterOp.Equal, 'eu-west-1');

    expect(scene.getLabelFiltersStatus([cluster])).toEqual({
      isValid: false,
      newPrimaryLabel: cluster,
      reason: PRIMARY_LABEL_REMOVED,
    });
  });

  test('promotes a different value of the route label', () => {
    const mimir = labelFilter(SERVICE_NAME, FilterOp.Equal, 'mimir');

    expect(scene.getLabelFiltersStatus([mimir])).toEqual({
      isValid: false,
      newPrimaryLabel: mimir,
      reason: PRIMARY_LABEL_REMOVED,
    });
  });

  test('skips filters that cannot be drilled into and uses the first selectable one', () => {
    const cluster = labelFilter('cluster', FilterOp.RegexEqual, 'eu-.+');

    expect(
      scene.getLabelFiltersStatus([
        labelFilter('pod', FilterOp.NotEqual, 'nginx'),
        labelFilter('namespace', FilterOp.RegexNotEqual, 'prod'),
        labelFilter('namespace', FilterOp.Equal, ''),
        labelFilter('namespace', FilterOp.Equal, EMPTY_VARIABLE_VALUE),
        labelFilter('namespace', FilterOp.Equal, ALL_VARIABLE_VALUE),
        labelFilter('namespace', FilterOp.Equal, '.*'),
        labelFilter('namespace', FilterOp.Equal, addAdHocFilterUserInputPrefix('.*')),
        labelFilter('', FilterOp.Equal, 'kept'),
        labelFilter('bytes', FilterOp.gt, '10'),
        cluster,
      ])
    ).toEqual({
      isValid: false,
      newPrimaryLabel: cluster,
      reason: PRIMARY_LABEL_REMOVED,
    });
  });

  test('treats a match-all .+ filter as a selectable primary label', () => {
    const matchAll = labelFilter('namespace', FilterOp.Equal, '.+');

    expect(scene.getLabelFiltersStatus([matchAll])).toEqual({
      isValid: false,
      newPrimaryLabel: matchAll,
      reason: PRIMARY_LABEL_REMOVED,
    });
  });

  test('returns no replacement when every remaining filter is excluded or match-all', () => {
    expect(
      scene.getLabelFiltersStatus([
        labelFilter(SERVICE_NAME, FilterOp.NotEqual, 'tempo-ingester'),
        labelFilter('cluster', FilterOp.Equal, '.*'),
        labelFilter('namespace', FilterOp.Equal, EMPTY_VARIABLE_VALUE),
        labelFilter('pod', FilterOp.Equal, ALL_VARIABLE_VALUE),
        labelFilter('host', FilterOp.gt, '1'),
      ])
    ).toEqual({ isValid: false, reason: PRIMARY_LABEL_REMOVED });
  });

  test('does not keep an exclusion of the route label as the current primary', () => {
    setRoute('cluster', 'eu-west-1');
    const pod = labelFilter('pod', FilterOp.Equal, 'nginx');

    expect(scene.getLabelFiltersStatus([labelFilter('cluster', FilterOp.NotEqual, 'eu-west-1'), pod])).toEqual({
      isValid: false,
      newPrimaryLabel: pod,
      reason: PRIMARY_LABEL_REMOVED,
    });
  });

  test('reads the primary label from the first embedded filter instead of the URL', () => {
    setRoute('cluster', 'eu-west-1');
    const filters = [
      labelFilter(SERVICE_NAME, FilterOp.Equal, 'tempo-ingester'),
      labelFilter('cluster', FilterOp.Equal, 'eu-west-1'),
    ];
    const embedded = new ServiceScene({
      $variables: new SceneVariableSet({
        variables: [new AdHocFiltersVariable({ filters, name: VAR_LABELS })],
      }),
      embedded: true,
    });

    expect(embedded.getLabelFiltersStatus(filters)).toEqual({ isValid: true });
  });

  test('replaces an embedded primary label that is no longer selectable', () => {
    const cluster = labelFilter('cluster', FilterOp.Equal, 'eu-west-1');
    const filters = [labelFilter(SERVICE_NAME, FilterOp.NotEqual, 'tempo-ingester'), cluster];
    const embedded = new ServiceScene({
      $variables: new SceneVariableSet({
        variables: [new AdHocFiltersVariable({ filters, name: VAR_LABELS })],
      }),
      embedded: true,
    });

    expect(embedded.getLabelFiltersStatus(filters)).toEqual({
      isValid: false,
      newPrimaryLabel: cluster,
      reason: PRIMARY_LABEL_REMOVED,
    });
  });
});
