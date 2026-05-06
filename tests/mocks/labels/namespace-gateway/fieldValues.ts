/**
 * Hand-written `GET /resources/detected_field/<name>/values` responses for
 * `{namespace="gateway"}`. Keyed by field name.
 */
export const fieldValues: Record<string, string[]> = {
  method: ['GET', 'POST', 'PUT', 'DELETE'],
  status: ['200', '201', '301', '400', '404', '500', '503'],
  path: ['/api/v1/login', '/api/v1/logout', '/api/v1/users', '/healthz'],
  duration_ms: ['12', '34', '78', '156', '512', '1024'],
  remote_addr: ['10.0.0.1', '10.0.0.2', '10.0.0.3'],
  detected_level: ['debug', 'info', 'warn', 'error'],
};
