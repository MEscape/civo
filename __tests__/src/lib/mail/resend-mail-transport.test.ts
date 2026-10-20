import { afterEach, describe, expect, it, vi } from 'vitest';

import { ResendMailTransport } from '@lib/mail/resend-mail-transport';

const OPTIONS = {
  apiKey: 're_secret_key',
  from: 'Civo <no-reply@example.org>',
  apiUrl: 'https://api.resend.com/emails',
};
const MAIL = { to: 'jane.doe@example.org', subject: 'S', text: 'T', html: 'H' };

function stubFetch(respond: () => Promise<Response>) {
  const fetchMock = vi.fn(respond);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The request body, which the code under test always sends as JSON text. */
function bodyOf(init: RequestInit): string {
  expect(typeof init.body).toBe('string');
  return init.body as string;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ResendMailTransport.send', () => {
  it('posts the message as JSON with the key as a bearer credential', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status: 200 })));

    const result = await new ResendMailTransport(OPTIONS).send(MAIL);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(result.isOk()).toBe(true);
    expect(url).toBe(OPTIONS.apiUrl);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: 'Bearer re_secret_key',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(bodyOf(init))).toEqual({
      from: OPTIONS.from,
      to: [MAIL.to],
      subject: 'S',
      text: 'T',
      html: 'H',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('fails with the status only when Resend refuses, never its body', async () => {
    stubFetch(() =>
      Promise.resolve(
        new Response('{"message":"jane.doe@example.org is blocked"}', { status: 422 }),
      ),
    );

    const error = (await new ResendMailTransport(OPTIONS).send(MAIL))._unsafeUnwrapErr();

    expect(error).toMatchObject({ code: 'mail.delivery_failed', cause: { status: 422 } });
    expect(JSON.stringify(error)).not.toContain('jane.doe');
  });

  it('fails with the shared delivery error when the request itself fails', async () => {
    const networkError = new TypeError('fetch failed');
    stubFetch(() => Promise.reject(networkError));

    const error = (await new ResendMailTransport(OPTIONS).send(MAIL))._unsafeUnwrapErr();

    expect(error).toMatchObject({
      kind: 'infrastructure',
      code: 'mail.delivery_failed',
      cause: networkError,
    });
  });

  it('never puts the API key in an error', async () => {
    stubFetch(() => Promise.resolve(new Response(null, { status: 401 })));

    const error = (await new ResendMailTransport(OPTIONS).send(MAIL))._unsafeUnwrapErr();

    expect(JSON.stringify(error)).not.toContain('re_secret_key');
  });
});
