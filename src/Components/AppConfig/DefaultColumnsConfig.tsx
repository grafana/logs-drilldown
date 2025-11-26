import React from 'react';

import { getDefaultDatasourceFromDatasourceSrv } from '../../services/store';
import { NoLokiSplash } from '../NoLokiSplash';
import { DefaultColumns } from './DefaultColumns';
import { DefaultColumnsContextProvider } from './DefaultColumnsContext';
import { DefaultColumnsDataSource } from './DefaultColumnsDataSource';
import { DefaultColumnsSubmit } from './DefaultColumnsSubmit';

const DefaultColumnsConfig = () => {
  const dsUID = getDefaultDatasourceFromDatasourceSrv();
  if (!dsUID) {
    return <NoLokiSplash />;
  }

  return (
    <main>
      <p>Configure default fields to display instead of the full log line:</p>

      <DefaultColumnsContextProvider initialDSUID={dsUID}>
        <header>
          <DefaultColumnsDataSource />
        </header>
        <section>
          <DefaultColumns />
        </section>
        <footer>
          <DefaultColumnsSubmit />
        </footer>
      </DefaultColumnsContextProvider>
    </main>
  );
};

export default DefaultColumnsConfig;
