import { getDataSourceInstance } from '@grafana/plugin-compat/datasources';
import { sceneGraph, SceneObject } from '@grafana/scenes';

import { getLokiDatasource } from './scenes';

jest.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstance: jest.fn(),
}));

describe('getLokiDatasource', () => {
  it('passes the resolved datasource uid, not the ${ds} expression', async () => {
    const scene = {} as SceneObject;
    const instance = { uid: 'gdev-loki' };
    jest.spyOn(sceneGraph, 'interpolate').mockReturnValue('gdev-loki');
    jest.mocked(getDataSourceInstance).mockResolvedValue(instance as never);

    await expect(getLokiDatasource(scene)).resolves.toBe(instance);

    expect(getDataSourceInstance).toHaveBeenCalledWith('gdev-loki');
  });
});
