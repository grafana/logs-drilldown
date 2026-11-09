import { config } from '@grafana/runtime';

import { createShortLink } from './links';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: { appSubUrl: '', bootData: { user: { orgId: 3 } }, namespace: 'default' },
  getAppEvents: jest.fn(),
}));

jest.mock('./logger', () => ({ logger: { error: jest.fn() } }));

type Trigger = Parameters<typeof createShortLink>[1];

const succeeds = (name: string) =>
  jest.fn().mockReturnValue({ unwrap: () => Promise.resolve({ metadata: { name } }) }) as unknown as jest.Mock &
    Trigger;
const fails = () =>
  jest.fn().mockReturnValue({ unwrap: () => Promise.reject(new Error('boom')) }) as unknown as jest.Mock & Trigger;

describe('createShortLink', () => {
  beforeEach(() => {
    createShortLink.cache.clear?.();
    config.namespace = 'default';
  });

  it('creates a ShortURL for the relative path and builds the goto link with the org id', async () => {
    const trigger = succeeds('sabc12');

    await expect(createShortLink(`${window.location.origin}/a/app/explore?x=1`, trigger)).resolves.toBe(
      `${window.location.origin}/goto/sabc12?orgId=3`
    );

    expect(trigger).toHaveBeenCalledWith({
      shortUrl: {
        apiVersion: 'shorturl.grafana.app/v1beta1',
        kind: 'ShortURL',
        metadata: { generateName: 's' },
        spec: { path: 'a/app/explore?x=1' },
      },
    });
  });

  it('omits the org id on Cloud stacks', async () => {
    config.namespace = 'stacks-123';

    await expect(createShortLink('a/b', succeeds('sabc12'))).resolves.toBe(`${window.location.origin}/goto/sabc12`);
  });

  it('reuses the request for the same path', async () => {
    const trigger = succeeds('sabc12');

    await createShortLink('a/b', trigger);
    await createShortLink('a/b', trigger);

    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('rejects on failure and only retries the failed path', async () => {
    const ok = succeeds('sok');
    await createShortLink('ok', ok);

    await expect(createShortLink('bad', fails())).rejects.toBeDefined();

    const retry = succeeds('sretry');
    await expect(createShortLink('bad', retry)).resolves.toContain('/goto/sretry');
    await createShortLink('ok', ok);

    expect(retry).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
