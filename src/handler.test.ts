/**
 * Handler integration tests.
 *
 * All tests mock `globalThis.fetch` so no real network calls are made.
 * Each step creates its own mock and restores the original in a finally block.
 */

import { assert, assertEquals, assertInstanceOf, assertRejects } from 'jsr:@std/assert';
import { Wrq } from './wrq.ts';
import { HttpError, TimeoutError } from './errors/mod.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Replaces globalThis.fetch with a function that records every call and
 * returns the Response produced by `makeResponse` for each call.
 * Returns the call log and a `restore` function.
 */
function mockFetch(makeResponse: () => Response = () => new Response('')) {
  const original = globalThis.fetch;
  const calls: Array<{ url: URL | RequestInfo; init?: RequestInit }> = [];

  globalThis.fetch = (url: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(makeResponse());
  };

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    }
  };
}

/** Shorthand: mock fetch to return a successful JSON response. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ---------------------------------------------------------------------------
// Response methods: .json(), .blob(), .raw(), .void()
// ---------------------------------------------------------------------------

Deno.test('Handler response methods', async (t) => {
  await t.step('.json() returns the parsed JSON body', async () => {
    const { restore } = mockFetch(() => jsonResponse({ id: 1, name: 'Alice' }));
    try {
      const result = await new Wrq({ baseUrl: 'https://example.com' }).get('/users/1').json();
      assertEquals(result, { id: 1, name: 'Alice' });
    } finally {
      restore();
    }
  });

  await t.step('.json(transform) applies the transform function to the parsed body', async () => {
    const { restore } = mockFetch(() => jsonResponse({ value: 42 }));
    try {
      const result = await new Wrq({ baseUrl: 'https://example.com' })
        .get('/data')
        .json<number>((raw) => (raw as { value: number }).value * 2);
      assertEquals(result, 84);
    } finally {
      restore();
    }
  });

  await t.step('.blob() returns the response body as a Blob', async () => {
    const { restore } = mockFetch(() => new Response(new Uint8Array([1, 2, 3]).buffer));
    try {
      const result = await new Wrq({ baseUrl: 'https://example.com' }).get('/file').blob();
      assertInstanceOf(result, Blob);
    } finally {
      restore();
    }
  });

  await t.step('.raw() returns the native Response object', async () => {
    const { restore } = mockFetch(() => new Response('ok', { status: 200 }));
    try {
      const result = await new Wrq({ baseUrl: 'https://example.com' }).get('/').raw();
      assertInstanceOf(result, Response);
      assertEquals(result.status, 200);
    } finally {
      restore();
    }
  });

  await t.step('.void() resolves to undefined', async () => {
    const { restore } = mockFetch();
    try {
      const result = await new Wrq({ baseUrl: 'https://example.com' }).delete('/resource/1').void();
      assertEquals(result, undefined);
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------

Deno.test('Handler URL construction', async (t) => {
  await t.step('concatenates baseUrl and path', async () => {
    const { calls, restore } = mockFetch();
    try {
      await new Wrq({ baseUrl: 'https://api.example.com' }).get('/users/42').void();
      assertEquals((calls[0].url as URL).href, 'https://api.example.com/users/42');
    } finally {
      restore();
    }
  });

  await t.step('works with a path that includes query parameters', async () => {
    const { calls, restore } = mockFetch();
    try {
      await new Wrq({ baseUrl: 'https://api.example.com' }).get('/search?q=hello').void();
      assertEquals((calls[0].url as URL).href, 'https://api.example.com/search?q=hello');
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// HTTP methods — correct verb is sent
// ---------------------------------------------------------------------------

Deno.test('Handler HTTP verbs', async (t) => {
  const verbs = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

  for (const verb of verbs) {
    await t.step(`sends ${verb}`, async () => {
      const { calls, restore } = mockFetch();
      try {
        const client = new Wrq({ baseUrl: 'https://example.com' });
        const method = verb.toLowerCase() as Lowercase<typeof verb>;

        if (method === 'post' || method === 'put' || method === 'patch') {
          await client[method]('/path', 'body').void();
        } else {
          await client[method]('/path').void();
        }

        assertEquals(calls[0].init?.method, verb);
      } finally {
        restore();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Request headers
// ---------------------------------------------------------------------------

Deno.test('Handler request headers', async (t) => {
  await t.step('sends instance-level default headers', async () => {
    const { calls, restore } = mockFetch();
    try {
      const client = new Wrq({
        baseUrl: 'https://example.com',
        headers: { 'X-App-Version': '1.0', 'Authorization': 'Bearer token' }
      });
      await client.get('/test').void();
      const sentHeaders = calls[0].init?.headers as Record<string, string>;
      assertEquals(sentHeaders['X-App-Version'], '1.0');
      assertEquals(sentHeaders['Authorization'], 'Bearer token');
    } finally {
      restore();
    }
  });

  await t.step('per-request headers are sent alongside instance headers', async () => {
    const { calls, restore } = mockFetch();
    try {
      const client = new Wrq({
        baseUrl: 'https://example.com',
        headers: { 'X-Default': 'default' }
      });
      await client.get('/test', { headers: { 'X-Request': 'per-request' } }).void();
      const sentHeaders = calls[0].init?.headers as Record<string, string>;
      assertEquals(sentHeaders['X-Default'], 'default');
      assertEquals(sentHeaders['X-Request'], 'per-request');
    } finally {
      restore();
    }
  });

  await t.step('per-request header overrides instance header of the same key', async () => {
    const { calls, restore } = mockFetch();
    try {
      const client = new Wrq({
        baseUrl: 'https://example.com',
        headers: { 'Authorization': 'Bearer instance-token' }
      });
      await client.get('/test', { headers: { 'Authorization': 'Bearer request-token' } }).void();
      const sentHeaders = calls[0].init?.headers as Record<string, string>;
      assertEquals(sentHeaders['Authorization'], 'Bearer request-token');
    } finally {
      restore();
    }
  });

  await t.step('cloned instance merges headers from both base and clone', async () => {
    const { calls, restore } = mockFetch();
    try {
      const base = new Wrq({
        baseUrl: 'https://example.com',
        headers: { 'X-Base': 'base-value' }
      });
      const cloned = base.clone({ headers: { 'X-Extra': 'extra-value' } });
      await cloned.get('/test').void();
      const sentHeaders = calls[0].init?.headers as Record<string, string>;
      assertEquals(sentHeaders['X-Base'], 'base-value');
      assertEquals(sentHeaders['X-Extra'], 'extra-value');
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------

Deno.test('Handler request body', async (t) => {
  await t.step('a string body is sent unchanged', async () => {
    const { calls, restore } = mockFetch();
    try {
      await new Wrq({ baseUrl: 'https://example.com' })
        .post('/data', 'raw-string')
        .void();
      assertEquals(calls[0].init?.body, 'raw-string');
    } finally {
      restore();
    }
  });

  await t.step('a plain-object body is JSON-stringified when json is true (default)', async () => {
    const { calls, restore } = mockFetch();
    try {
      const payload = { name: 'Alice', age: 30 };
      await new Wrq({ baseUrl: 'https://example.com' })
        .post('/users', payload as unknown as BodyInit)
        .void();
      assertEquals(calls[0].init?.body, JSON.stringify(payload));
    } finally {
      restore();
    }
  });

  await t.step('a plain-object body is NOT stringified when json is false', async () => {
    const { calls, restore } = mockFetch();
    try {
      const payload = { name: 'Alice' };
      await new Wrq({ baseUrl: 'https://example.com', json: false })
        .post('/users', payload as unknown as BodyInit)
        .void();
      // Body should be the original object reference, not a JSON string
      assertEquals(typeof calls[0].init?.body, 'object');
    } finally {
      restore();
    }
  });

  await t.step('per-request json:false overrides instance json:true', async () => {
    const { calls, restore } = mockFetch();
    try {
      const payload = { x: 1 };
      await new Wrq({ baseUrl: 'https://example.com', json: true })
        .post('/data', payload as unknown as BodyInit, { json: false })
        .void();
      assertEquals(typeof calls[0].init?.body, 'object');
    } finally {
      restore();
    }
  });

  await t.step('FormData body is passed through without stringification', async () => {
    const { calls, restore } = mockFetch();
    try {
      const fd = new FormData();
      fd.append('field', 'value');
      await new Wrq({ baseUrl: 'https://example.com' }).post('/upload', fd).void();
      assertInstanceOf(calls[0].init?.body, FormData);
    } finally {
      restore();
    }
  });

  await t.step('undefined body results in a null body being sent', async () => {
    const { calls, restore } = mockFetch();
    try {
      await new Wrq({ baseUrl: 'https://example.com' }).post('/empty').void();
      assertEquals(calls[0].init?.body, null);
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

Deno.test('Handler error handling', async (t) => {
  await t.step('throws HttpError for a 4xx response', async () => {
    const { restore } = mockFetch(() => new Response('Not Found', { status: 404, statusText: 'Not Found' }));
    try {
      await assertRejects(
        () => new Wrq({ baseUrl: 'https://example.com' }).get('/missing').void(),
        HttpError
      );
    } finally {
      restore();
    }
  });

  await t.step('throws HttpError for a 5xx response', async () => {
    const { restore } = mockFetch(() => new Response('Error', { status: 500, statusText: 'Internal Server Error' }));
    try {
      await assertRejects(
        () => new Wrq({ baseUrl: 'https://example.com' }).get('/broken').void(),
        HttpError
      );
    } finally {
      restore();
    }
  });

  await t.step('HttpError carries the response object', async () => {
    const { restore } = mockFetch(() => new Response('Forbidden', { status: 403, statusText: 'Forbidden' }));
    try {
      const err = await assertRejects(
        () => new Wrq({ baseUrl: 'https://example.com' }).get('/secret').void(),
        HttpError
      );
      assertEquals((err as HttpError).response?.status, 403);
    } finally {
      restore();
    }
  });

  await t.step('HttpError message includes the status code', async () => {
    const { restore } = mockFetch(() => new Response('', { status: 422, statusText: 'Unprocessable Entity' }));
    try {
      const err = await assertRejects(
        () => new Wrq({ baseUrl: 'https://example.com' }).post('/validate', '{}').void(),
        HttpError
      );
      assert((err as HttpError).message.includes('422'));
    } finally {
      restore();
    }
  });

  await t.step('throws TimeoutError when the per-request timeout elapses', async () => {
    // Fetch never resolves — simulates a hung connection.
    const original = globalThis.fetch;
    globalThis.fetch = () => new Promise(() => {});
    try {
      await assertRejects(
        () => new Wrq({ baseUrl: 'https://example.com' }).get('/slow', { timeout: 20 }).void(),
        TimeoutError
      );
    } finally {
      globalThis.fetch = original;
    }
  });

  await t.step('TimeoutError message includes the timeout value', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => new Promise(() => {});
    try {
      const err = await assertRejects(
        () => new Wrq({ baseUrl: 'https://example.com' }).get('/slow', { timeout: 50 }).void(),
        TimeoutError
      );
      assert((err as TimeoutError).message.includes('50ms'));
    } finally {
      globalThis.fetch = original;
    }
  });

  await t.step('user-initiated abort via AbortController throws a DOMException', async () => {
    // Mock: reject immediately if signal is already aborted.
    const original = globalThis.fetch;
    globalThis.fetch = (_url: URL | RequestInfo, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      }
      return Promise.resolve(new Response(''));
    };

    const controller = new AbortController();
    controller.abort();

    try {
      const err = await assertRejects(
        () => new Wrq({ baseUrl: 'https://example.com' }).get('/test', { controller }).void()
      );
      assertInstanceOf(err, DOMException);
    } finally {
      globalThis.fetch = original;
    }
  });
});

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

Deno.test('Handler hooks', async (t) => {
  // --- beforeRequest ---

  await t.step('beforeRequest hook is called before the request is sent', async () => {
    const { restore } = mockFetch(() => jsonResponse({}));
    let hookCalled = false;
    try {
      await new Wrq({
        baseUrl: 'https://example.com',
        hooks: { beforeRequest: () => { hookCalled = true; } }
      }).get('/test').void();
      assertEquals(hookCalled, true);
    } finally {
      restore();
    }
  });

  await t.step('beforeRequest hook receives the current request options', async () => {
    const { restore } = mockFetch();
    let receivedMethod: string | undefined;
    try {
      await new Wrq({
        baseUrl: 'https://example.com',
        hooks: {
          beforeRequest: (options) => {
            receivedMethod = (options as { method?: string }).method;
          }
        }
      }).post('/test', 'body').void();
      assertEquals(receivedMethod, 'POST');
    } finally {
      restore();
    }
  });

  await t.step('beforeRequest returned options are deep-merged into the request', async () => {
    const { calls, restore } = mockFetch();
    try {
      await new Wrq({
        baseUrl: 'https://example.com',
        hooks: {
          beforeRequest: (options) => ({
            headers: {
              ...(options.headers as Record<string, string>),
              'X-Injected': 'from-hook'
            }
          })
        }
      }).get('/test').void();
      const sentHeaders = calls[0].init?.headers as Record<string, string>;
      assertEquals(sentHeaders['X-Injected'], 'from-hook');
    } finally {
      restore();
    }
  });

  await t.step('async beforeRequest hook is awaited before the fetch call is made', async () => {
    const { calls, restore } = mockFetch();
    const order: string[] = [];
    try {
      await new Wrq({
        baseUrl: 'https://example.com',
        hooks: {
          beforeRequest: async () => {
            await new Promise<void>((resolve) => setTimeout(resolve, 10));
            order.push('hook');
          }
        }
      }).get('/test').void();
      order.push('after-await');
      // The hook must have finished before fetch was called (which resolved
      // synchronously in our mock), so 'hook' appears before 'after-await'.
      assertEquals(order, ['hook', 'after-await']);
      assertEquals(calls.length, 1);
    } finally {
      restore();
    }
  });

  await t.step('beforeRequest returning void leaves the original options unchanged', async () => {
    const { calls, restore } = mockFetch();
    try {
      await new Wrq({
        baseUrl: 'https://example.com',
        headers: { 'X-Default': 'value' },
        hooks: { beforeRequest: () => { /* returns nothing */ } }
      }).get('/test').void();
      const sentHeaders = calls[0].init?.headers as Record<string, string>;
      assertEquals(sentHeaders['X-Default'], 'value');
    } finally {
      restore();
    }
  });

  // --- onResponse ---

  await t.step('onResponse hook is called for a successful 2xx response', async () => {
    const { restore } = mockFetch(() => new Response('', { status: 200 }));
    let hookCalled = false;
    try {
      await new Wrq({
        baseUrl: 'https://example.com',
        hooks: { onResponse: () => { hookCalled = true; } }
      }).get('/test').void();
      assertEquals(hookCalled, true);
    } finally {
      restore();
    }
  });

  await t.step('onResponse hook is called even for a 4xx response', async () => {
    const { restore } = mockFetch(() => new Response('', { status: 404 }));
    let hookCalled = false;
    try {
      await assertRejects(
        async () => {
          await new Wrq({
            baseUrl: 'https://example.com',
            hooks: { onResponse: () => { hookCalled = true; } }
          }).get('/missing').void();
        },
        HttpError
      );
      assertEquals(hookCalled, true);
    } finally {
      restore();
    }
  });

  await t.step('onResponse receives a clone — consuming it does not affect .json()', async () => {
    const { restore } = mockFetch(() => jsonResponse({ id: 99 }));
    let hookBodyConsumed = false;
    try {
      const result = await new Wrq({
        baseUrl: 'https://example.com',
        hooks: {
          onResponse: async (clonedResponse) => {
            await clonedResponse.text(); // consume the clone
            hookBodyConsumed = true;
          }
        }
      }).get('/test').json<{ id: number }>();
      assertEquals(hookBodyConsumed, true);
      assertEquals(result, { id: 99 }); // original body still readable
    } finally {
      restore();
    }
  });

  // --- onSuccess ---

  await t.step('onSuccess hook is called for a 2xx response', async () => {
    const { restore } = mockFetch(() => new Response('', { status: 201 }));
    let hookCalled = false;
    try {
      await new Wrq({
        baseUrl: 'https://example.com',
        hooks: { onSuccess: () => { hookCalled = true; } }
      }).post('/items', 'body').void();
      assertEquals(hookCalled, true);
    } finally {
      restore();
    }
  });

  await t.step('onSuccess hook is NOT called for a 4xx response', async () => {
    const { restore } = mockFetch(() => new Response('', { status: 400 }));
    let hookCalled = false;
    try {
      await assertRejects(
        async () => {
          await new Wrq({
            baseUrl: 'https://example.com',
            hooks: { onSuccess: () => { hookCalled = true; } }
          }).get('/bad').void();
        },
        HttpError
      );
      assertEquals(hookCalled, false);
    } finally {
      restore();
    }
  });

  await t.step('onSuccess receives a clone — consuming it does not affect .json()', async () => {
    const { restore } = mockFetch(() => jsonResponse({ ok: true }));
    let hookBodyConsumed = false;
    try {
      const result = await new Wrq({
        baseUrl: 'https://example.com',
        hooks: {
          onSuccess: async (clonedResponse) => {
            await clonedResponse.json(); // consume the clone
            hookBodyConsumed = true;
          }
        }
      }).get('/test').json<{ ok: boolean }>();
      assertEquals(hookBodyConsumed, true);
      assertEquals(result, { ok: true }); // original body still readable
    } finally {
      restore();
    }
  });

  // --- onError ---

  await t.step('onError hook is called when an HttpError is thrown', async () => {
    const { restore } = mockFetch(() => new Response('', { status: 500 }));
    let caughtError: Error | undefined;
    try {
      await assertRejects(
        async () => {
          await new Wrq({
            baseUrl: 'https://example.com',
            hooks: { onError: (err) => { caughtError = err; } }
          }).get('/broken').void();
        },
        HttpError
      );
      assertInstanceOf(caughtError, HttpError);
    } finally {
      restore();
    }
  });

  await t.step('onError hook is called when an AbortController aborts the request', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (_url: URL | RequestInfo, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }
      return Promise.resolve(new Response(''));
    };

    let onErrorCalled = false;
    let onAbortCalled = false;
    const controller = new AbortController();
    controller.abort();

    try {
      await assertRejects(
        async () => {
          await new Wrq({
            baseUrl: 'https://example.com',
            hooks: {
              onError: () => { onErrorCalled = true; },
              onAbort: () => { onAbortCalled = true; }
            }
          }).get('/test', { controller }).void();
        }
      );
      // The DOMException from fetch abort falls through to onError
      // (not onAbort) because the current implementation only matches
      // onAbort when the thrown value is a primitive string.
      assertEquals(onErrorCalled, true);
      assertEquals(onAbortCalled, false);
    } finally {
      globalThis.fetch = original;
    }
  });

  await t.step('the error is re-thrown after the onError hook runs', async () => {
    const { restore } = mockFetch(() => new Response('', { status: 404 }));
    try {
      await assertRejects(
        () => new Wrq({
          baseUrl: 'https://example.com',
          hooks: { onError: () => { /* swallowed inside hook, should still rethrow */ } }
        }).get('/gone').void(),
        HttpError
      );
    } finally {
      restore();
    }
  });

  // --- onTimeout ---

  await t.step('onTimeout hook is called when the request times out', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => new Promise(() => {});
    let hookCalled = false;
    try {
      await assertRejects(
        async () => {
          await new Wrq({
            baseUrl: 'https://example.com',
            hooks: { onTimeout: () => { hookCalled = true; } }
          }).get('/slow', { timeout: 20 }).void();
        },
        TimeoutError
      );
      assertEquals(hookCalled, true);
    } finally {
      globalThis.fetch = original;
    }
  });

  await t.step('onError hook is NOT called when the request times out', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => new Promise(() => {});
    let onErrorCalled = false;
    try {
      await assertRejects(
        async () => {
          await new Wrq({
            baseUrl: 'https://example.com',
            hooks: {
              onError: () => { onErrorCalled = true; },
              onTimeout: () => {}
            }
          }).get('/slow', { timeout: 20 }).void();
        },
        TimeoutError
      );
      assertEquals(onErrorCalled, false);
    } finally {
      globalThis.fetch = original;
    }
  });

  await t.step('async onTimeout hook is awaited before the error is re-thrown', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => new Promise(() => {});
    const order: string[] = [];
    try {
      await assertRejects(async () => {
        await new Wrq({
          baseUrl: 'https://example.com',
          hooks: {
            onTimeout: async () => {
              await new Promise<void>((resolve) => setTimeout(resolve, 10));
              order.push('hook-done');
            }
          }
        }).get('/slow', { timeout: 20 }).void();
      });
      order.push('after-reject');
      assertEquals(order, ['hook-done', 'after-reject']);
    } finally {
      globalThis.fetch = original;
    }
  });
});

// ---------------------------------------------------------------------------
// Per-request timeout override
// ---------------------------------------------------------------------------

Deno.test('Handler per-request timeout', async (t) => {
  await t.step('a short per-request timeout fires before the default 10 s timeout', async () => {
    const start = Date.now();
    const original = globalThis.fetch;
    globalThis.fetch = () => new Promise(() => {});
    try {
      await assertRejects(
        () => new Wrq({ baseUrl: 'https://example.com' }).get('/slow', { timeout: 30 }).void(),
        TimeoutError
      );
      const elapsed = Date.now() - start;
      // Must complete well under the default 10 s
      assert(elapsed < 2000, `Expected timeout < 2000ms, got ${elapsed}ms`);
    } finally {
      globalThis.fetch = original;
    }
  });
});
