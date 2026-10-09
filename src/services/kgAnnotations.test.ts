import { DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/plugin-compat/datasources';

import { getKgSceneProps, isKgAnnotationsAvailable } from './kgAnnotations';
import { getFeatureFlag } from 'featureFlags/openFeature';

jest.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstanceSettings: jest.fn(),
}));

jest.mock('featureFlags/openFeature', () => ({
  getFeatureFlag: jest.fn(),
}));

const KG_DATASOURCE_UID = 'grafanacloud-knowledgegraph';

describe('isKgAnnotationsAvailable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getFeatureFlag).mockReturnValue(true);
  });

  it('is false without looking up the datasource when the feature flag is off', async () => {
    jest.mocked(getFeatureFlag).mockReturnValue(false);

    await expect(isKgAnnotationsAvailable()).resolves.toBe(false);
    expect(getDataSourceInstanceSettings).not.toHaveBeenCalled();
  });

  it('is true when the knowledge graph datasource exists', async () => {
    jest
      .mocked(getDataSourceInstanceSettings)
      .mockResolvedValue({ uid: KG_DATASOURCE_UID } as DataSourceInstanceSettings);

    await expect(isKgAnnotationsAvailable()).resolves.toBe(true);
    expect(getDataSourceInstanceSettings).toHaveBeenCalledWith(KG_DATASOURCE_UID);
  });

  it('is false when the knowledge graph datasource does not exist', async () => {
    jest.mocked(getDataSourceInstanceSettings).mockResolvedValue(undefined);

    await expect(isKgAnnotationsAvailable()).resolves.toBe(false);
  });
});

describe('getKgSceneProps', () => {
  it('returns nothing when the knowledge graph datasource is not available', () => {
    expect(getKgSceneProps(false)).toBeUndefined();
  });

  it('returns the scene props when the knowledge graph datasource is available', () => {
    expect(getKgSceneProps(true)).toEqual(
      expect.objectContaining({
        $data: expect.anything(),
        behaviors: expect.any(Array),
        controls: expect.anything(),
      })
    );
  });
});
