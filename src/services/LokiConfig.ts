import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { SceneObject } from '@grafana/scenes';

import { logger } from './logger';
import { LokiDatasource } from './lokiQuery';
import { getDataSource } from './scenes';
import { LokiLanguageProvider } from './TagValuesProviders';

export const getGlobalConfig = async (sceneRef: SceneObject) => {
  const datasourceUnknownType = await getDataSourceSrv().get(getDataSource(sceneRef));
  // Narrow the DataSourceApi type to DataSourceWithBackend
  if (!(datasourceUnknownType instanceof DataSourceWithBackend)) {
    logger.error(new Error('getTagValuesProvider: Invalid datasource!'));
    throw new Error('Invalid datasource!');
  }

  // Assert datasource is Loki
  const lokiDatasource = datasourceUnknownType as LokiDatasource;
  // Assert language provider is LokiLanguageProvider
  const languageProvider = lokiDatasource.languageProvider as LokiLanguageProvider;
  return languageProvider.getGlobalConfig();
};
