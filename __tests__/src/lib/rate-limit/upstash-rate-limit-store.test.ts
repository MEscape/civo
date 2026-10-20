import { afterEach, describe, expect, it, vi } from 'vitest';

import { UpstashRateLimitStore } from '@lib/rate-limit/upstash-rate-limit-store';

const REST_URL = 'https://eu1-example-12345.upstash.io';
const TOKEN = 'secret-token';
const TIMEOUT_MS = 1500;

interface Sent {
  readonly url: string;
  readonly method: string | undefined;
  readonly headers: HeadersInit | undefined;
  readonly body: unknown;
}

/** A `fetch` that answers every call with `answer` and remembers what it was asked. */
function fakeFetch(answer: () => Response): { fetch: typeof fetch; sent: Sent[] } {
  const sent: Sent[] = [];
  return {
    sent,
    fetch: (input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
      sent.push({ url, method: init?.method, headers: init?.headers, body });
      return Promise.resolve(answer());
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function storeWith(fetchImpl: typeof fetch, restUrl = REST_URL): UpstashRateLimitStore {
  return new UpstashRateLimitStore({
    restUrl,
    restToken: TOKEN,
    timeoutMs: TIMEOUT_MS,
    fetch: fetchImpl,
  });
}

describe('UpstashRateLimitStore', () => {
  it('counts one attempt with a single authenticated script call and reads the window', async () => {
    const { fetch: send, sent } = fakeFetch(() => jsonResponse({ result: [3, 41_250] }));

    const hit = await storeWith(send).hit('auth.sign-in:identifier:abc', 60);

    expect(hit).toEqual({ hits: 3, retryAfterSeconds: 42 });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe(REST_URL);
    expect(sent[0]?.method).toBe('POST');
    expect(sent[0]?.headers).toEqual({
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    });
    expect(sent[0]?.body).toEqual([
      'EVAL',
      expect.stringContaining("'NX'"),
      1,
      'rate-limit:auth.sign-in:identifier:abc',
      60,
    ]);
  });

  it('accepts an endpoint written with a trailing slash', async () => {
    const { fetch: send, sent } = fakeFetch(() => jsonResponse({ result: [1, 1000] }));

    await storeWith(send, `${REST_URL}//`).hit('k', 1);

    expect(sent[0]?.url).toBe(REST_URL);
  });

  it('rounds the time left up to a whole second', async () => {
    const { fetch: send } = fakeFetch(() => jsonResponse({ result: [1, 1] }));

    expect((await storeWith(send).hit('k', 60)).retryAfterSeconds).toBe(1);
  });

  it('rejects when Upstash refuses the request, so the policy decides what happens', async () => {
    const { fetch: send } = fakeFetch(() => jsonResponse({ error: 'Invalid token' }, 401));

    await expect(storeWith(send).hit('k', 60)).rejects.toThrow('HTTP 401');
  });

  it.each([
    ['a failed script', { error: 'ERR Error running script' }],
    ['no result', {}],
    ['a result of the wrong length', { result: [1] }],
    ['a counter below one', { result: [0, 1000] }],
    ['a counter without a lifetime', { result: [1, -1] }],
    ['text instead of numbers', { result: ['OK', 'OK'] }],
  ])('rejects %s instead of guessing a count', async (_name, body) => {
    const { fetch: send } = fakeFetch(() => jsonResponse(body));

    await expect(storeWith(send).hit('k', 60)).rejects.toThrow('unexpected shape');
  });

  it('rejects when the network fails', async () => {
    const send: typeof fetch = () => Promise.reject(new TypeError('fetch failed'));

    await expect(storeWith(send).hit('k', 60)).rejects.toThrow('fetch failed');
  });

  it('abandons a request that does not answer within the timeout', async () => {
    const send: typeof fetch = async (_input, init) => {
      await new Promise<void>((resolve) => {
        init?.signal?.addEventListener('abort', () => {
          resolve();
        });
      });
      init?.signal?.throwIfAborted();
      return jsonResponse([]);
    };
    const store = new UpstashRateLimitStore({
      restUrl: REST_URL,
      restToken: TOKEN,
      timeoutMs: 20,
      fetch: send,
    });

    await expect(store.hit('k', 60)).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});

describe('UpstashRateLimitStore with the platform fetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the global fetch when none is injected', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ result: [2, 30_000] })));
    vi.stubGlobal('fetch', fetchMock);
    const store = new UpstashRateLimitStore({
      restUrl: REST_URL,
      restToken: TOKEN,
      timeoutMs: TIMEOUT_MS,
    });

    await expect(store.hit('k', 60)).resolves.toEqual({ hits: 2, retryAfterSeconds: 30 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
