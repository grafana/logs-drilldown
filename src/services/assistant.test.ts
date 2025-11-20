import { createAssistantContextItem } from '@grafana/assistant';
import { AdHocFiltersVariable, SceneObject } from '@grafana/scenes';

import { updateAssistantContext } from './assistant';
import { FilterOp } from './filterTypes';
import { getLokiDatasource } from './scenes';
import { getFieldsVariable, getLabelsVariable, getLevelsVariable, getMetadataVariable } from './variableGetters';
import { VAR_FIELDS, VAR_LABELS, VAR_LEVELS, VAR_METADATA } from './variables';

jest.mock('./scenes');
jest.mock('./variableGetters', () => ({
  ...jest.requireActual('./variableGetters'),
  getFieldsVariable: jest.fn(),
  getLabelsVariable: jest.fn(),
  getLevelsVariable: jest.fn(),
  getMetadataVariable: jest.fn(),
}));

// Mock relevant assistant sdk functions
jest.mock('@grafana/assistant', () => ({
  createAssistantContextItem: jest.fn((_, data) => ({
    node: {
      data,
    },
  })),
}));

const mockCreateAssistantContextItem = createAssistantContextItem as jest.MockedFunction<
  typeof createAssistantContextItem
>;

describe('assistant', () => {
  let mockModel: SceneObject;
  let mockSetAssistantContext: jest.MockedFunction<any>;
  const mockDatasource = {
    name: 'test-loki',
    uid: 'loki-uid-123',
    type: 'loki',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockModel = {} as SceneObject;
    mockSetAssistantContext = jest.fn();
    jest.mocked(getLabelsVariable).mockReturnValue(
      new AdHocFiltersVariable({
        name: VAR_LABELS,
        filters: [],
      })
    );
    jest.mocked(getLevelsVariable).mockReturnValue(
      new AdHocFiltersVariable({
        name: VAR_LEVELS,
        filters: [],
      })
    );
    jest.mocked(getMetadataVariable).mockReturnValue(
      new AdHocFiltersVariable({
        name: VAR_METADATA,
        filters: [],
      })
    );
    jest.mocked(getFieldsVariable).mockReturnValue(
      new AdHocFiltersVariable({
        name: VAR_FIELDS,
        filters: [],
      })
    );
  });

  describe('updateAssistantContext', () => {
    it('should return early when datasource is not available', async () => {
      jest.mocked(getLokiDatasource).mockResolvedValue(undefined);

      await updateAssistantContext(mockModel, mockSetAssistantContext);

      expect(getLokiDatasource).toHaveBeenCalledWith(mockModel);
      expect(mockSetAssistantContext).not.toHaveBeenCalled();
      expect(getLabelsVariable).not.toHaveBeenCalled();
    });

    it('should create datasource context when datasource is available but no label filters', async () => {
      const mockLabelsVariable = new AdHocFiltersVariable({
        name: VAR_LABELS,
        filters: [],
      });

      jest.mocked(getLokiDatasource).mockResolvedValue(mockDatasource as any);
      jest.mocked(getLabelsVariable).mockReturnValue(mockLabelsVariable);

      await updateAssistantContext(mockModel, mockSetAssistantContext);

      expect(getLokiDatasource).toHaveBeenCalledWith(mockModel);
      expect(getLabelsVariable).toHaveBeenCalledWith(mockModel);
      expect(mockCreateAssistantContextItem).toHaveBeenCalledWith('datasource', {
        datasourceUid: 'loki-uid-123',
      });
    });

    it('should create datasource context and label value contexts when filters are present', async () => {
      const mockLabelsVariable = new AdHocFiltersVariable({
        name: VAR_LABELS,
        filters: [
          { key: 'service', value: 'frontend', operator: FilterOp.Equal },
          { key: 'environment', value: 'production', operator: FilterOp.Equal },
        ],
      });

      jest.mocked(getLokiDatasource).mockResolvedValue(mockDatasource as any);
      jest.mocked(getLabelsVariable).mockReturnValue(mockLabelsVariable);

      await updateAssistantContext(mockModel, mockSetAssistantContext);

      expect(getLokiDatasource).toHaveBeenCalledWith(mockModel);
      expect(getLabelsVariable).toHaveBeenCalledWith(mockModel);

      expect(mockCreateAssistantContextItem).toHaveBeenCalledWith('datasource', {
        datasourceUid: 'loki-uid-123',
      });
      expect(mockCreateAssistantContextItem).toHaveBeenCalledWith('label_value', {
        datasourceUid: 'loki-uid-123',
        labelName: 'service',
        labelValue: 'frontend',
      });
      expect(mockCreateAssistantContextItem).toHaveBeenCalledWith('label_value', {
        datasourceUid: 'loki-uid-123',
        labelName: 'environment',
        labelValue: 'production',
      });
    });

    it('should handle single label filter correctly', async () => {
      const mockLabelsVariable = new AdHocFiltersVariable({
        name: VAR_LABELS,
        filters: [{ key: 'app', value: 'api-server', operator: FilterOp.Equal }],
      });

      jest.mocked(getLokiDatasource).mockResolvedValue(mockDatasource as any);
      jest.mocked(getLabelsVariable).mockReturnValue(mockLabelsVariable);

      await updateAssistantContext(mockModel, mockSetAssistantContext);

      expect(mockCreateAssistantContextItem).toHaveBeenCalledWith('datasource', {
        datasourceUid: 'loki-uid-123',
      });
      expect(mockCreateAssistantContextItem).toHaveBeenCalledWith('label_value', {
        datasourceUid: 'loki-uid-123',
        labelName: 'app',
        labelValue: 'api-server',
      });
    });

    it('should handle null datasource gracefully', async () => {
      jest.mocked(getLokiDatasource).mockResolvedValue(null as any);

      await updateAssistantContext(mockModel, mockSetAssistantContext);

      expect(getLokiDatasource).toHaveBeenCalledWith(mockModel);
      expect(mockSetAssistantContext).not.toHaveBeenCalled();
      expect(getLabelsVariable).not.toHaveBeenCalled();
    });

    it('should add labels, levels, metadata, and fields to the context', async () => {
      jest.mocked(getLokiDatasource).mockResolvedValue(mockDatasource as any);
      jest.mocked(getLabelsVariable).mockReturnValue(
        new AdHocFiltersVariable({
          name: VAR_LABELS,
          filters: [
            {
              key: 'label',
              operator: '=',
              value: 'value',
            },
          ],
        })
      );
      jest.mocked(getLevelsVariable).mockReturnValue(
        new AdHocFiltersVariable({
          name: VAR_LEVELS,
          filters: [
            {
              key: 'detected_level',
              operator: '=',
              value: 'error',
            },
            {
              key: 'detected_level',
              operator: '=',
              value: 'warning',
            },
          ],
        })
      );
      jest.mocked(getMetadataVariable).mockReturnValue(
        new AdHocFiltersVariable({
          name: VAR_METADATA,
          filters: [
            {
              key: 'metadata1',
              operator: '=',
              value: 'value1',
            },
            {
              key: 'metadata2',
              operator: '!=',
              value: 'value2',
            },
          ],
        })
      );
      jest.mocked(getFieldsVariable).mockReturnValue(
        new AdHocFiltersVariable({
          name: VAR_FIELDS,
          filters: [
            {
              key: 'field1',
              operator: '=',
              value: '{"parser":"logfmt","value":"value1"}',
            },
            {
              key: 'field2',
              operator: '!=',
              value: '{"parser":"json","value":"value2"}',
            },
          ],
        })
      );

      await updateAssistantContext(mockModel, mockSetAssistantContext);

      expect(mockSetAssistantContext).toHaveBeenCalledWith([
        {
          node: {
            data: {
              datasourceUid: 'loki-uid-123',
            },
          },
        },
        {
          node: {
            data: {
              datasourceUid: 'loki-uid-123',
              labelName: 'label',
              labelValue: 'value',
            },
          },
        },
        {
          node: {
            data: {
              datasourceUid: 'loki-uid-123',
              labelName: 'detected_level',
              labelValue: 'error',
            },
          },
        },
        {
          node: {
            data: {
              datasourceUid: 'loki-uid-123',
              labelName: 'detected_level',
              labelValue: 'warning',
            },
          },
        },
        {
          node: {
            data: {
              data: {
                datasourceUid: 'loki-uid-123',
                fieldName: 'metadata1',
                fieldValue: 'value1',
              },
              hidden: true,
              title: 'Structured metadata filters',
            },
          },
        },
        {
          node: {
            data: {
              data: {
                datasourceUid: 'loki-uid-123',
                fieldName: 'metadata2',
                fieldValue: '!=value2',
              },
              hidden: true,
              title: 'Structured metadata filters',
            },
          },
        },
        {
          node: {
            data: {
              data: {
                datasourceUid: 'loki-uid-123',
                fieldName: 'field1',
                fieldValue: 'value1',
                parser: 'logfmt',
              },
              hidden: true,
              title: 'Parsed fields filters',
            },
          },
        },
        {
          node: {
            data: {
              data: {
                datasourceUid: 'loki-uid-123',
                fieldName: 'field2',
                fieldValue: '!=value2',
                parser: 'json',
              },
              hidden: true,
              title: 'Parsed fields filters',
            },
          },
        },
      ]);
    });
  });
});
