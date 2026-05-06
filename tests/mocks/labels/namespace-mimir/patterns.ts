/**
 * Hand-written `GET /resources/patterns` response for `{namespace="mimir"}`.
 * Distinct count vs `namespace-gateway` so Part 2 of the namespace tabs test
 * can assert the patterns tab badge changed when switching primary label.
 */
export const patterns = {
  status: 'success',
  data: [
    {
      pattern: 'level=info ts=<_> caller=ingester.go:212 msg="successfully appended" tenant=<_> series=<_>',
      level: 'info',
      samples: [
        [1777909140, 220],
        [1777909150, 232],
        [1777909160, 215],
      ],
    },
    {
      pattern: 'level=info ts=<_> caller=block.go:81 msg="block uploaded" block_id=<_>',
      level: 'info',
      samples: [
        [1777909140, 8],
        [1777909150, 7],
        [1777909160, 11],
      ],
    },
    {
      pattern: 'level=warn ts=<_> caller=querier.go:140 msg="slow query" duration_ms=<_>',
      level: 'warn',
      samples: [
        [1777909140, 14],
        [1777909150, 12],
        [1777909160, 9],
      ],
    },
    {
      pattern: 'level=error ts=<_> caller=ruler.go:55 msg="rule evaluation failed" user=<_>',
      level: 'error',
      samples: [
        [1777909140, 3],
        [1777909150, 2],
        [1777909160, 4],
      ],
    },
    {
      pattern: 'level=debug ts=<_> caller=compactor.go:118 msg="compaction shard" shard=<_>',
      level: 'debug',
      samples: [
        [1777909140, 5],
        [1777909150, 6],
        [1777909160, 5],
      ],
    },
  ],
} as const;
