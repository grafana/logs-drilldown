import { AdHocFiltersVariable, SceneObject } from '@grafana/scenes';

import { updateAssistantContext } from './assistant';
import { FilterOp } from './filterTypes';
import { getLokiDatasource } from './scenes';
import { getLabelsVariable } from './variableGetters';
import { VAR_LABELS } from './variables';

jest.mock('./scenes');
jest.mock('./variableGetters');

const mockGetLokiDatasource = getLokiDatasource as jest.MockedFunction<typeof getLokiDatasource>;
const mockGetLabelsVariable = getLabelsVariable as jest.MockedFunction<typeof getLabelsVariable>;

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
      expect(mockSetAssistantContext).toHaveBeenCalledWith([
        expect.objectContaining({
          node: expect.objectContaining({
            data: expect.objectContaining({
              datasourceName: 'test-loki',
              datasourceUid: 'loki-uid-123',
              datasourceType: 'loki',
            }),
          }),
        }),
      ]);
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

      expect(mockSetAssistantContext).toHaveBeenCalledWith([
        expect.objectContaining({
          node: expect.objectContaining({
            data: expect.objectContaining({
              datasourceName: 'test-loki',
              datasourceUid: 'loki-uid-123',
              datasourceType: 'loki',
            }),
          }),
        }),
        expect.objectContaining({
          node: expect.objectContaining({
            data: expect.objectContaining({
              datasourceUid: 'loki-uid-123',
              datasourceType: 'loki',
              labelName: 'service',
              labelValue: 'frontend',
            }),
          }),
        }),
        expect.objectContaining({
          node: expect.objectContaining({
            data: expect.objectContaining({
              datasourceUid: 'loki-uid-123',
              datasourceType: 'loki',
              labelName: 'environment',
              labelValue: 'production',
            }),
          }),
        }),
      ]);
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

      expect(mockSetAssistantContext).toHaveBeenCalledWith([
        expect.objectContaining({
          node: expect.objectContaining({
            data: expect.objectContaining({
              datasourceName: 'single-loki',
              datasourceUid: 'single-uid',
              datasourceType: 'loki',
            }),
          }),
        }),
        expect.objectContaining({
          node: expect.objectContaining({
            data: expect.objectContaining({
              datasourceUid: 'single-uid',
              datasourceType: 'loki',
              labelName: 'app',
              labelValue: 'api-server',
            }),
          }),
        }),
      ]);
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
