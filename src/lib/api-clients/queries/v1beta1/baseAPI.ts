import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '../../utils/createBaseQuery';
import { getAPIBaseURL } from '../../utils/utils';

// Currently, we are loading all query templates
// Organizations can have maximum of 1000 query templates
export const QUERY_LIBRARY_GET_LIMIT = 1000;

export const BASE_URL = getAPIBaseURL('queries.grafana.app', 'v1beta1');

export const api = createApi({
  reducerPath: 'queriesAPIv1beta1',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
