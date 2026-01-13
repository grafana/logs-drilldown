import { QUERY_LIBRARY_GET_LIMIT } from './baseAPI';
import { generatedAPI } from './endpoints.gen';

export const queriesAPIv1beta1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    // Need to mutate the generated query to force query limit
    listQuery: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (originalQuery) {
        endpointDefinition.query = (requestOptions) =>
          originalQuery({
            ...requestOptions,
            limit: QUERY_LIBRARY_GET_LIMIT,
          });
      }
    },
    // Need to mutate the generated query to set the Content-Type header correctly
    updateQuery: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (originalQuery) {
        endpointDefinition.query = (requestOptions) => ({
          ...originalQuery(requestOptions),
          headers: {
            'Content-Type': 'application/merge-patch+json',
          },
        });
      }
    },
    createQuery: (endpointDefinition) => {
      endpointDefinition.onQueryStarted = async (_, { queryFulfilled, dispatch }) => {
        // due to the fact that we're rendering the list after the query is created,
        // we need to update the cached list so we show the new query instantly,
        const { data } = await queryFulfilled;
        dispatch(
          generatedAPI.util.updateQueryData('listQuery', {}, (list) => {
            list.items = [...(list.items || []), data];
          })
        );
      };
    },
  },
});

export const { useCreateQueryMutation, useDeleteQueryMutation, useListQueryQuery, useUpdateQueryMutation } =
  queriesAPIv1beta1;

export type { QuerySpec, Query, ListQueryApiResponse } from './endpoints.gen';
