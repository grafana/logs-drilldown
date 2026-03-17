import { LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords } from '@grafana/api-clients/rtkq/logsdrilldown/v1beta1';

import { LOKI_CONFIG_API_NOT_SUPPORTED, LokiConfig } from './datasourceTypes';
import { getMetadataService, initializeMetadataService, MetadataService } from './metadata';

// Minimal shape for default columns in tests
const mockDefaultColumns = {
  records: [],
} as unknown as LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords;

describe('MetadataService', () => {
  let service: MetadataService;

  beforeEach(() => {
    service = new MetadataService();
  });

  describe('serviceSceneState', () => {
    it('returns undefined when never set', () => {
      expect(service.getServiceSceneState()).toBeUndefined();
    });

    it('initializes state and sets patternsCount', () => {
      service.setPatternsCount(5);
      expect(service.getServiceSceneState()).toEqual({ patternsCount: 5 });
    });

    it('initializes state and sets labelsCount', () => {
      service.setLabelsCount(3);
      expect(service.getServiceSceneState()).toEqual({ labelsCount: 3 });
    });

    it('initializes state and sets embedded', () => {
      service.setEmbedded(true);
      expect(service.getServiceSceneState()).toEqual({ embedded: true });
    });

    it('initializes state and sets fieldsCount', () => {
      service.setFieldsCount(10);
      expect(service.getServiceSceneState()).toEqual({ fieldsCount: 10 });
    });

    it('initializes state and sets totalLogsCount', () => {
      service.setTotalLogsCount(100);
      expect(service.getServiceSceneState()).toEqual({ totalLogsCount: 100 });
    });

    it('merges multiple setters into same state', () => {
      service.setPatternsCount(2);
      service.setLabelsCount(4);
      service.setEmbedded(false);
      expect(service.getServiceSceneState()).toEqual({
        patternsCount: 2,
        labelsCount: 4,
        embedded: false,
      });
    });

    it('setServiceSceneState replaces state with full snapshot', () => {
      service.setServiceSceneState({
        embedded: true,
        fieldsCount: 1,
        labelsCount: 2,
        loading: false,
        logsCount: 50,
        patternsCount: 3,
        totalLogsCount: 100,
      });
      expect(service.getServiceSceneState()).toEqual({
        embedded: true,
        fieldsCount: 1,
        labelsCount: 2,
        loading: false,
        logsCount: 50,
        patternsCount: 3,
        totalLogsCount: 100,
      });
    });
  });

  describe('lokiConfig', () => {
    it('getLokiConfig returns undefined when never set', () => {
      expect(service.getLokiConfig()).toBeUndefined();
    });

    it('setLokiConfig and getLokiConfig round-trip', () => {
      const config = { limits: {}, pattern_ingester_enabled: true, version: '1.0' } as LokiConfig;
      service.setLokiConfig(config);
      expect(service.getLokiConfig()).toBe(config);
    });

    it('setLokiConfig accepts LOKI_CONFIG_API_NOT_SUPPORTED', () => {
      service.setLokiConfig(LOKI_CONFIG_API_NOT_SUPPORTED);
      expect(service.getLokiConfig()).toBe(LOKI_CONFIG_API_NOT_SUPPORTED);
    });
  });

  describe('defaultColumns', () => {
    it('getDefaultColumns returns undefined for unknown dsUID', () => {
      expect(service.getDefaultColumns('unknown-ds')).toBeUndefined();
    });

    it('setDefaultColumns and getDefaultColumns round-trip by dsUID', () => {
      const columnsA = { ...mockDefaultColumns };
      const columnsB = { ...mockDefaultColumns };
      service.setDefaultColumns(columnsA, 'ds-1');
      service.setDefaultColumns(columnsB, 'ds-2');
      expect(service.getDefaultColumns('ds-1')).toBe(columnsA);
      expect(service.getDefaultColumns('ds-2')).toBe(columnsB);
    });

    it('setDefaultColumns overwrites for same dsUID', () => {
      service.setDefaultColumns(mockDefaultColumns, 'ds-1');
      const updated = { ...mockDefaultColumns };
      service.setDefaultColumns(updated, 'ds-1');
      expect(service.getDefaultColumns('ds-1')).toBe(updated);
    });
  });

  describe('defaultLabels', () => {
    it('getDefaultLabels returns null when never set', () => {
      expect(service.getDefaultLabels()).toBeNull();
    });

    it('setDefaultLabels and getDefaultLabels round-trip', () => {
      const labels = { 'ds-1': [{ label: 'level', values: ['info', 'error'] }] };
      service.setDefaultLabels(labels);
      expect(service.getDefaultLabels()).toBe(labels);
    });

    it('setDefaultLabels null clears default labels', () => {
      service.setDefaultLabels({ 'ds-1': [] });
      service.setDefaultLabels(null);
      expect(service.getDefaultLabels()).toBeNull();
    });

    it('getDefaultLabelsForDS returns labels for dsUID', () => {
      const labels = [{ label: 'level', values: ['info'] }];
      service.setDefaultLabels({ 'ds-1': labels });
      expect(service.getDefaultLabelsForDS('ds-1')).toEqual(labels);
      expect(service.getDefaultLabelsForDS('ds-2')).toBeUndefined();
    });

    it('getDefaultLabelsForDS returns undefined when defaultLabels is null', () => {
      expect(service.getDefaultLabelsForDS('ds-1')).toBeUndefined();
    });

    it('getDefaultLabelValuesForDS returns values for label', () => {
      service.setDefaultLabels({
        'ds-1': [
          { label: 'level', values: ['info', 'error'] },
          { label: 'env', values: ['prod'] },
        ],
      });
      expect(service.getDefaultLabelValuesForDS('ds-1', 'level')).toEqual(['info', 'error']);
      expect(service.getDefaultLabelValuesForDS('ds-1', 'env')).toEqual(['prod']);
      expect(service.getDefaultLabelValuesForDS('ds-1', 'missing')).toBeUndefined();
      expect(service.getDefaultLabelValuesForDS('ds-2', 'level')).toBeUndefined();
    });

    it('getDefaultLabelValuesForDS returns undefined when defaultLabels is null', () => {
      expect(service.getDefaultLabelValuesForDS('ds-1', 'level')).toBeUndefined();
    });

    it('getDefaultLabelForDS returns first label', () => {
      service.setDefaultLabels({
        'ds-1': [
          { label: 'level', values: ['info'] },
          { label: 'env', values: ['prod'] },
        ],
      });
      expect(service.getDefaultLabelForDS('ds-1')).toBe('level');
    });

    it('getDefaultLabelForDS returns undefined for unknown ds or empty list', () => {
      service.setDefaultLabels({ 'ds-1': [] });
      expect(service.getDefaultLabelForDS('ds-1')).toBeUndefined();
      expect(service.getDefaultLabelForDS('ds-2')).toBeUndefined();
    });

    it('getDefaultLabelForDS returns undefined when defaultLabels is null', () => {
      expect(service.getDefaultLabelForDS('ds-1')).toBeUndefined();
    });
  });
});

describe('initializeMetadataService', () => {
  beforeEach(() => {
    initializeMetadataService(true);
  });

  it('creates metadata service when not yet initialized', () => {
    initializeMetadataService(true);
    const service = getMetadataService();
    expect(service).toBeInstanceOf(MetadataService);
  });

  it('force=true replaces existing service', () => {
    const first = getMetadataService();
    first.setPatternsCount(42);
    initializeMetadataService(true);
    const second = getMetadataService();
    expect(second).toBeInstanceOf(MetadataService);
    expect(second.getServiceSceneState()).toBeUndefined();
  });
});

describe('getMetadataService', () => {
  beforeEach(() => {
    initializeMetadataService(true);
  });

  it('returns the same singleton instance after init', () => {
    const a = getMetadataService();
    const b = getMetadataService();
    expect(a).toBe(b);
  });
});
