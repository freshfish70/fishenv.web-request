import { afterAll, describe, expect, test } from 'bun:test';
import { Wrq } from '../wrq.ts';
import { lazyClone } from './lazyClone.ts';

describe('lazyClone', () => {
  test('exposes status and headers without cloning', () => {
    const response = new Response('hello', { status: 201, headers: { 'x-test': '1' } });
    let clones = 0;
    const original = response.clone.bind(response);
    response.clone = () => {
      clones++;
      return original();
    };

    const wrapped = lazyClone(response);

    expect(wrapped.status).toBe(201);
    expect(wrapped.ok).toBe(true);
    expect(wrapped.headers.get('x-test')).toBe('1');
    expect(wrapped).toBeInstanceOf(Response);
    expect(clones).toBe(0);
  });

  test('checking bodyUsed does not clone', () => {
    const response = new Response('hello');
    let clones = 0;
    const original = response.clone.bind(response);
    response.clone = () => {
      clones++;
      return original();
    };

    expect(lazyClone(response).bodyUsed).toBe(false);
    expect(clones).toBe(0);
  });

  test('reading the body leaves the original unconsumed', async () => {
    const response = new Response('hello');
    const wrapped = lazyClone(response);

    expect(await wrapped.text()).toBe('hello');
    expect(response.bodyUsed).toBe(false);
    expect(await response.text()).toBe('hello');
  });

  test('clones only once across multiple body reads', async () => {
    const response = new Response(JSON.stringify({ a: 1 }));
    const wrapped = lazyClone(response);

    expect(wrapped.bodyUsed).toBe(false);
    expect(await wrapped.json()).toEqual({ a: 1 });
    expect(wrapped.bodyUsed).toBe(true);
    expect(response.bodyUsed).toBe(false);
  });
});

describe('response hooks with streaming bodies', () => {
  let cancelled = false;

  const server = Bun.serve({
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === '/json') {
        return Response.json({ ok: true });
      }

      cancelled = false;
      const stream = new ReadableStream({
        async pull(controller) {
          await Bun.sleep(5);
          controller.enqueue(new TextEncoder().encode('data: tick\n\n'));
        },
        cancel() {
          cancelled = true;
        }
      });
      return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
    }
  });

  afterAll(() => server.stop(true));

  test('cancelling a stream reaches the server when hooks only inspect status', async () => {
    const statuses: number[] = [];
    const client = new Wrq({
      baseUrl: `http://localhost:${server.port}`,
      hooks: {
        onResponse: (response) => {
          statuses.push(response.status);
        },
        onSuccess: (response) => {
          statuses.push(response.status);
        }
      }
    });

    const response = await client.get('/stream').raw();
    if (!response.body) {
      throw new Error('Expected a response body');
    }
    const reader = response.body.getReader();
    await reader.read();

    const cancel = reader.cancel();
    const result = await Promise.race([cancel.then(() => 'resolved'), Bun.sleep(1000).then(() => 'timeout')]);
    await Bun.sleep(50);

    expect(statuses).toEqual([200, 200]);
    expect(result).toBe('resolved');
    expect(cancelled).toBe(true);
  });

  test('each response hook can read the body independently', async () => {
    const bodies: unknown[] = [];
    const client = new Wrq({
      baseUrl: `http://localhost:${server.port}`,
      hooks: {
        onResponse: async (response) => {
          bodies.push(await response.json());
        },
        onSuccess: async (response) => {
          bodies.push(await response.json());
        }
      }
    });

    const result = await client.get('/json').json();

    expect(bodies).toEqual([{ ok: true }, { ok: true }]);
    expect(result).toEqual({ ok: true });
  });
});
