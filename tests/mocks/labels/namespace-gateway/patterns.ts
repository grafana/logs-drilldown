/**
 * Hand-written `GET /resources/patterns` response for `{namespace="gateway"}`.
 * Sample data shape mirrors a real Loki capture.
 */
export const patterns = {
  status: 'success',
  data: [
    {
      pattern: 'level=info ts=<_> caller=server.go:32 msg="request" method=<_> path=<_> status=<_>',
      level: 'info',
      samples: [
        [1777909140, 320],
        [1777909150, 312],
        [1777909160, 305],
      ],
    },
    {
      pattern: 'level=warn ts=<_> caller=server.go:32 msg="slow request" method=<_> path=<_> duration_ms=<_>',
      level: 'warn',
      samples: [
        [1777909140, 12],
        [1777909150, 9],
        [1777909160, 11],
      ],
    },
    {
      pattern: 'level=error ts=<_> caller=server.go:48 msg="upstream error" status=<_>',
      level: 'error',
      samples: [
        [1777909140, 4],
        [1777909150, 5],
        [1777909160, 3],
      ],
    },
  ],
} as const;
