import { test } from '@grafana/plugin-e2e';

// Implement a custom version of the @grafana/plugin-e2e auth setup as upstream does not support Grafana running in a subdirectory
// @see https://github.com/grafana/plugin-tools/blob/main/packages/plugin-e2e/src/auth/auth.setup.ts
// @see https://github.com/grafana/plugin-tools/blob/main/packages/plugin-e2e/src/fixtures/commands/login.ts
test('authenticate', async ({ request, user }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== 'string') {
    throw new Error('Playwright baseURL must be configured for Grafana authentication');
  }
  if (typeof user !== 'object' || !user.user || !user.password) {
    throw new Error('Playwright user must be configured for Grafana authentication');
  }

  const grafanaBaseURL = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
  const loginResponse = await request.post(new URL('./login', grafanaBaseURL).toString(), { data: user });
  if (!loginResponse.ok()) {
    throw new Error(`Could not login to Grafana using user '${user.user}': ${await loginResponse.text()}`);
  }
  await request.storageState({ path: `playwright/.auth/${user.user}.json` });
});
