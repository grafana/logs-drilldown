/**
 * Captured `GET /resources/patterns` response for
 * `{service_name="nginx-json-mixed"}`.
 */
export const patterns = {
  status: 'success',
  data: [
    {
      pattern: '<_>The flag is <_>',
      level: 'info',
      samples: [
        [1777910050, 31],
        [1777910060, 11],
      ],
    },
    {
      pattern: "<_>I'm a little teapot<_>",
      level: 'debug',
      samples: [
        [1777910040, 3],
        [1777910050, 27],
        [1777910060, 11],
      ],
    },
    {
      pattern: "<_>I'm a little teapot<_>",
      level: 'info',
      samples: [
        [1777910040, 1],
        [1777910050, 29],
        [1777910060, 9],
      ],
    },
  ],
} as const;
