import { createAssistantContextItem } from '@grafana/assistant';
import { AdHocFiltersVariable, SceneObject } from '@grafana/scenes';

import { updateAssistantContext } from './assistant';
import { FilterOp } from './filterTypes';
import { getLokiDatasource } from './scenes';
import { getLabelsVariable } from './variableGetters';
import { VAR_LABELS } from './variables';

jest.mock('./scenes');
jest.mock('./variableGetters');

// Mock relevant assistant sdk functions
jest.mock('@grafana/assistant', () => ({
  createAssistantContextItem: jest.fn((_, data) => ({
    node: {
      data,
    },
  })),
}));

const mockGetLokiDatasource = getLokiDatasource as jest.MockedFunction<typeof getLokiDatasource>;
const mockGetLabelsVariable = getLabelsVariable as jest.MockedFunction<typeof getLabelsVariable>;
const mockCreateAssistantContextItem = createAssistantContextItem as jest.MockedFunction<
  typeof createAssistantContextItem
>;

describe('assistant', () => {
  let mockModel: SceneObject;
  let mockSetAssistantContext: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockModel = {} as SceneObject;
    mockSetAssistantContext = jest.fn();
  });

  describe('updateAssistantContext', () => {
    it('should return early when datasource is not available', async () => {
      mockGetLokiDatasource.mockResolvedValue(undefined);

      await updateAssistantContext(mockModel, mockSetAssistantContext);

      expect(mockGetLokiDatasource).toHaveBeenCalledWith(mockModel);
      expect(mockSetAssistantContext).not.toHaveBeenCalled();
      expect(mockGetLabelsVariable).not.toHaveBeenCalled();
    });

    it('should create datasource context when datasource is available but no label filters', async () => {
      const mockDatasource = {
        name: 'test-loki',
        uid: 'loki-uid-123',
        type: 'loki',
      };

      const mockLabelsVariable = new AdHocFiltersVariable({
        name: VAR_LABELS,
        filters: [],
      });

      mockGetLokiDatasource.mockResolvedValue(mockDatasource as any);
      mockGetLabelsVariable.mockReturnValue(mockLabelsVariable);

      await updateAssistantContext(mockModel, mockSetAssistantContext);

      expect(mockGetLokiDatasource).toHaveBeenCalledWith(mockModel);
      expect(mockGetLabelsVariable).toHaveBeenCalledWith(mockModel);
      expect(mockCreateAssistantContextItem).toHaveBeenCalledWith('datasource', {
        datasourceUid: 'loki-uid-123',
      });
    });

    it('should create datasource context and label value contexts when filters are present', async () => {
      const mockDatasource = {
        name: 'test-loki',
        uid: 'loki-uid-123',
        type: 'loki',
      };

      const mockLabelsVariable = new AdHocFiltersVariable({
        name: VAR_LABELS,
        filters: [
          { key: 'service', value: 'frontend', operator: FilterOp.Equal },
          { key: 'environment', value: 'production', operator: FilterOp.Equal },
        ],
      });

      mockGetLokiDatasource.mockResolvedValue(mockDatasource as any);
      mockGetLabelsVariable.mockReturnValue(mockLabelsVariable);

      await updateAssistantContext(mockModel, mockSetAssistantContext);

      expect(mockGetLokiDatasource).toHaveBeenCalledWith(mockModel);
      expect(mockGetLabelsVariable).toHaveBeenCalledWith(mockModel);

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
      const mockDatasource = {
        name: 'single-loki',
        uid: 'single-uid',
        type: 'loki',
      };

      const mockLabelsVariable = {
        state: {
          filters: [{ key: 'app', value: 'api-server' }],
        },
      } as AdHocFiltersVariable;

      mockGetLokiDatasource.mockResolvedValue(mockDatasource as any);
      mockGetLabelsVariable.mockReturnValue(mockLabelsVariable);

      await updateAssistantContext(mockModel, mockSetAssistantContext);

      expect(mockCreateAssistantContextItem).toHaveBeenCalledWith('datasource', {
        datasourceUid: 'single-uid',
      });
      expect(mockCreateAssistantContextItem).toHaveBeenCalledWith('label_value', {
        datasourceUid: 'single-uid',
        labelName: 'app',
        labelValue: 'api-server',
      });
    });

    it('should handle null datasource gracefully', async () => {
      mockGetLokiDatasource.mockResolvedValue(null as any);

      await updateAssistantContext(mockModel, mockSetAssistantContext);

      expect(mockGetLokiDatasource).toHaveBeenCalledWith(mockModel);
      expect(mockSetAssistantContext).not.toHaveBeenCalled();
      expect(mockGetLabelsVariable).not.toHaveBeenCalled();
    });
  });
});
