// We want volumes to change between executions, but not the ordering, so we add 1 to the volume each time
let increment = 0;

export const getMockVolumeApiResponse = () => {
  return {
    data: {
      result: [
        {
          metric: {
            service_name: 'tempo-distributor',
          },
          value: [1722536046.066, (53826521 + increment++).toString()],
        },
        {
          metric: {
            service_name: 'tempo-ingester',
          },
          value: [1722536046.066, '51585442'],
        },
        {
          metric: {
            service_name: 'mimir-ingester',
          },
          value: [1722536046.066, '2340497'],
        },
        {
          metric: {
            service_name: 'httpd',
          },
          value: [1722536046.066, '2093405'],
        },
        {
          metric: {
            service_name: 'nginx-json',
          },
          value: [1722536046.066, '1654774'],
        },
        {
          metric: {
            service_name: 'mimir-distributor',
          },
          value: [1722536046.066, '1516802'],
        },
        {
          metric: {
            service_name: 'mimir-querier',
          },
          value: [1722536046.066, '984900'],
        },
        {
          metric: {
            service_name: 'nginx',
          },
          value: [1722536046.066, '926310'],
        },
        {
          metric: {
            service_name: 'apache',
          },
          value: [1722536046.066, '874633'],
        },
        {
          metric: {
            service_name: 'mimir-ruler',
          },
          value: [1722536046.066, '301744'],
        },
      ],
      resultType: 'vector',
      stats: {
        cache: {
          chunk: {
            bytesReceived: 0,
            bytesSent: 0,
            downloadTime: 0,
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            queryLengthServed: 0,
            requests: 0,
          },
          index: {
            bytesReceived: 0,
            bytesSent: 0,
            downloadTime: 0,
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            queryLengthServed: 0,
            requests: 0,
          },
          instantMetricResult: {
            bytesReceived: 0,
            bytesSent: 0,
            downloadTime: 0,
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            queryLengthServed: 0,
            requests: 0,
          },
          labelResult: {
            bytesReceived: 0,
            bytesSent: 0,
            downloadTime: 0,
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            queryLengthServed: 0,
            requests: 0,
          },
          result: {
            bytesReceived: 0,
            bytesSent: 0,
            downloadTime: 0,
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            queryLengthServed: 0,
            requests: 0,
          },
          seriesResult: {
            bytesReceived: 0,
            bytesSent: 0,
            downloadTime: 0,
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            queryLengthServed: 0,
            requests: 0,
          },
          statsResult: {
            bytesReceived: 0,
            bytesSent: 0,
            downloadTime: 0,
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            queryLengthServed: 0,
            requests: 0,
          },
          volumeResult: {
            bytesReceived: 0,
            bytesSent: 0,
            downloadTime: 0,
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            queryLengthServed: 0,
            requests: 0,
          },
        },
        index: {
          postFilterChunks: 0,
          shardsDuration: 0,
          totalChunks: 0,
        },
        ingester: {
          store: {
            chunk: {
              compressedBytes: 0,
              decompressedBytes: 0,
              decompressedLines: 0,
              decompressedStructuredMetadataBytes: 0,
              headChunkBytes: 0,
              headChunkLines: 0,
              headChunkStructuredMetadataBytes: 0,
              postFilterLines: 0,
              totalDuplicates: 0,
            },
            chunkRefsFetchTime: 0,
            chunksDownloadTime: 0,
            congestionControlLatency: 0,
            pipelineWrapperFilteredLines: 0,
            queryReferencedStructuredMetadata: false,
            totalChunksDownloaded: 0,
            totalChunksRef: 0,
          },
          totalBatches: 0,
          totalChunksMatched: 0,
          totalLinesSent: 0,
          totalReached: 0,
        },
        querier: {
          store: {
            chunk: {
              compressedBytes: 0,
              decompressedBytes: 0,
              decompressedLines: 0,
              decompressedStructuredMetadataBytes: 0,
              headChunkBytes: 0,
              headChunkLines: 0,
              headChunkStructuredMetadataBytes: 0,
              postFilterLines: 0,
              totalDuplicates: 0,
            },
            chunkRefsFetchTime: 0,
            chunksDownloadTime: 0,
            congestionControlLatency: 0,
            pipelineWrapperFilteredLines: 0,
            queryReferencedStructuredMetadata: false,
            totalChunksDownloaded: 0,
            totalChunksRef: 0,
          },
        },
        summary: {
          bytesProcessedPerSecond: 0,
          execTime: 0.375358251,
          linesProcessedPerSecond: 0,
          queueTime: 0,
          shards: 0,
          splits: 1,
          subqueries: 0,
          totalBytesProcessed: 0,
          totalEntriesReturned: 10,
          totalLinesProcessed: 0,
          totalPostFilterLines: 0,
          totalStructuredMetadataBytesProcessed: 0,
        },
      },
    },
    status: 'success',
  };
};
