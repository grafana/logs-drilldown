import { AdHocFilterWithLabels } from '@grafana/scenes';

import {
  decodeOrGroupFromFieldsFilter,
  encodeOrGroupInFieldsFilter,
  filterFiltersDissolvingOrGroups,
  getFilterConnectors,
  getFilterOrGroup,
  joinFieldAndMetadataFilters,
  setFilterOrGroup,
  splitFieldAndMetadataFilters,
  toggleFilterConnector,
} from './fieldFilterOrGroups';
import { isFilterMetadata } from './filters';
import { FilterOp } from './filterTypes';
import { addAdHocFilterUserInputPrefix } from './variables';

jest.mock('services/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const parsedField = (key: string, value: string): AdHocFilterWithLabels => ({
  key,
  operator: FilterOp.Equal,
  value: JSON.stringify({ parser: 'logfmt', value }),
  valueLabels: [value],
});

const metadata = (key: string, value: string): AdHocFilterWithLabels => ({
  key,
  operator: FilterOp.Equal,
  value: addAdHocFilterUserInputPrefix(value),
  valueLabels: [value],
});

const orGroups = (filters: AdHocFilterWithLabels[]) => filters.map(getFilterOrGroup);

describe('getFilterConnectors', () => {
  it('returns the connector between each pair of adjacent filters', () => {
    const filters = [
      setFilterOrGroup(parsedField('status', '500'), 1),
      setFilterOrGroup(metadata('level', 'error'), 1),
      parsedField('pod', 'a'),
      parsedField('pod', 'b'),
      metadata('pod', 'c'),
    ];

    expect(getFilterConnectors(filters)).toEqual(['or', 'and', 'sameFieldOr', 'and']);
  });

  it('treats an OR group with a single member as standalone', () => {
    expect(getFilterConnectors([setFilterOrGroup(parsedField('pod', 'a'), 1), parsedField('pod', 'b')])).toEqual([
      'sameFieldOr',
    ]);
  });
});

describe('toggleFilterConnector', () => {
  it('merges the filters on both sides of an AND connector into an OR group', () => {
    const filters = [parsedField('status', '500'), metadata('level', 'error'), parsedField('path', '/api')];

    const toggled = toggleFilterConnector(filters, 0);
    expect(orGroups(toggled)).toEqual([1, 1, undefined]);
    expect(getFilterConnectors(toggled)).toEqual(['or', 'and']);

    const extended = toggleFilterConnector(toggled, 1);
    expect(orGroups(extended)).toEqual([1, 1, 1]);
  });

  it('pulls filters that are OR-ed on the same field into the new group', () => {
    const filters = [parsedField('pod', 'a'), parsedField('pod', 'b'), parsedField('level', 'error')];

    expect(orGroups(toggleFilterConnector(filters, 1))).toEqual([1, 1, 1]);
  });

  it('splits an OR group at the connector', () => {
    const filters = [1, 1, 1].map((orGroup, index) => setFilterOrGroup(parsedField(`field${index}`, 'value'), orGroup));

    const toggled = toggleFilterConnector(filters, 1);
    expect(orGroups(toggled)).toEqual([1, 1, undefined]);
    expect(getFilterConnectors(toggled)).toEqual(['or', 'and']);
  });

  it('does not change filters on the same field', () => {
    const filters = [parsedField('pod', 'a'), parsedField('pod', 'b')];

    expect(toggleFilterConnector(filters, 0)).toBe(filters);
  });
});

describe('fields variable encoding', () => {
  it('round trips the OR group of parsed fields and metadata through the fields variable value', () => {
    const grouped = [
      setFilterOrGroup(parsedField('status', '500'), 1),
      setFilterOrGroup(metadata('level', 'error'), 1),
    ];

    const encoded = grouped.map(encodeOrGroupInFieldsFilter);
    expect(encoded.map((filter) => filter.value)).toEqual([
      '{"orGroup":1,"parser":"logfmt","value":"500"}',
      addAdHocFilterUserInputPrefix('{"orGroup":1,"parser":"structuredMetadata","value":"error"}'),
    ]);
    expect(encoded.map(getFilterOrGroup)).toEqual([undefined, undefined]);

    const decoded = encoded.map(decodeOrGroupFromFieldsFilter);
    expect(decoded).toEqual([
      { ...parsedField('status', '500'), orGroup: 1 },
      { ...metadata('level', 'error'), orGroup: 1 },
    ]);
  });

  it('leaves standalone filters untouched', () => {
    const filter = parsedField('status', '500');

    expect(encodeOrGroupInFieldsFilter(filter)).toBe(filter);
    expect(decodeOrGroupFromFieldsFilter(filter)).toBe(filter);
  });
});

describe('splitFieldAndMetadataFilters', () => {
  it('routes OR groups to the fields variable and standalone metadata to the metadata variable', () => {
    const standaloneMetadata = metadata('cluster', 'us');
    const filters = [
      standaloneMetadata,
      setFilterOrGroup(parsedField('status', '500'), 1),
      setFilterOrGroup(metadata('level', 'error'), 1),
      setFilterOrGroup(parsedField('path', '/api'), 2),
    ];

    const { fieldFilters, metadataFilters } = splitFieldAndMetadataFilters(filters);
    expect(metadataFilters).toEqual([standaloneMetadata]);
    expect(fieldFilters.map((filter) => filter.key)).toEqual(['status', 'level', 'path']);
    // "path" was the only member of its group, so it is routed as a standalone field
    expect(fieldFilters[2]).toEqual(parsedField('path', '/api'));

    expect(joinFieldAndMetadataFilters(fieldFilters, metadataFilters)).toEqual([
      standaloneMetadata,
      { ...parsedField('status', '500'), orGroup: 1 },
      { ...metadata('level', 'error'), orGroup: 1 },
      parsedField('path', '/api'),
    ]);
  });
});

describe('filterFiltersDissolvingOrGroups', () => {
  it('removes OR groups that contain a removed filter', () => {
    const standaloneMetadata = metadata('cluster', 'us');
    const filters = [
      standaloneMetadata,
      setFilterOrGroup(parsedField('status', '500'), 1),
      setFilterOrGroup(metadata('level', 'error'), 1),
    ];

    expect(filterFiltersDissolvingOrGroups(filters, isFilterMetadata)).toEqual([standaloneMetadata]);
  });
});
