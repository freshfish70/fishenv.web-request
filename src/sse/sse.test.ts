import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { AbortError, HttpError, SseError, TimeoutError } from '../errors/mod.ts';
import { Wrq } from '../wrq.ts';

const encoder = new TextEncoder();

let cancelled = false;
let seenHeaders: Headers | null = null;

const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    seenHeaders = request.headers;
    if (path === '/missing') {
      return Response.json({ code: 'NOT_FOUND' }, { status: 404 });
    }
    if (path === '/json') {
      return Response.json({ ok: true });
    }
    if (path === '/slow') {
      await Bun.sleep(200);
      return new Response('late');
    }
    let n = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        await Bun.sleep(5);
        controller.enqueue(encoder.encode(`id: ${n}\ndata: ${n++}\n\n`));
      },
      cancel() {
        cancelled = true;
      }
    });
    return new Response(body, { headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
  }
});

afterAll(() => server.stop(true));
beforeEach(() => {
  cancelled = false;
});

const client = (hooks = {}) =>
  new Wrq({ baseUrl: `http://localhost:${server.port}`, headers: { accept: 'application/json' }, hooks });

/** The server sees a cancelled body a moment after the client closes */
async function serverCancelled(): Promise<boolean> {
  for (let i = 0; i < 50 && !cancelled; i++) {
    await Bun.sleep(10);
  }
  return cancelled;
}

describe('handler.sse()', () => {
  test('yields events until the loop ends, then closes the connection', async () => {
    const seen: string[] = [];
    for await (const event of await client().get('/events').sse()) {
      seen.push(`${event.id}:${event.data}`);
      if (seen.length === 3) {
        break;
      }
    }
    expect(seen).toEqual(['0:0', '1:1', '2:2']);
    expect(await serverCancelled()).toBe(true);
  });

  test('replaces the instance Accept header and sends Last-Event-ID', async () => {
    const events = await client().get('/events').sse({ lastEventId: '41' });
    events.close();
    expect(seenHeaders?.get('accept')).toBe('text/event-stream');
    expect(seenHeaders?.get('last-event-id')).toBe('41');
  });

  test('close() before iterating closes the connection and ends the iteration', async () => {
    const events = await client().get('/events').sse();
    events.close();
    expect(await events.next()).toEqual({ done: true, value: undefined });
    expect(await serverCancelled()).toBe(true);
  });

  test('return() before iterating closes the connection', async () => {
    const events = await client().get('/events').sse();
    await events.return?.();
    expect(await serverCancelled()).toBe(true);
  });

  test('close() while a read is pending ends that read', async () => {
    const events = await client().get('/events').sse();
    await events.next();
    const pending = events.next();
    events.close();
    await pending;
    // Whatever was already read may still arrive; then the iteration ends rather than waiting for more
    const rest = await Promise.race([Array.fromAsync(events), Bun.sleep(500).then(() => 'hung')]);
    expect(rest).toBeArray();
    expect(await serverCancelled()).toBe(true);
  });

  test('aborting the controller makes the iteration throw an AbortError', async () => {
    const controller = new AbortController();
    const events = await client().get('/events', { controller }).sse();
    await events.next();
    controller.abort('user left');
    await expect(events.next()).rejects.toBeInstanceOf(AbortError);
    expect(await serverCancelled()).toBe(true);
  });

  test('a failed open rejects with HttpError, with a readable body', async () => {
    const error = await client()
      .get('/missing')
      .sse()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(await (error as HttpError).response?.json()).toEqual({ code: 'NOT_FOUND' });
  });

  test('a response that is not an event stream rejects with SseError', async () => {
    await expect(client().get('/json').sse()).rejects.toBeInstanceOf(SseError);
  });

  test('hooks that only read the status leave the stream cancellable', async () => {
    const statuses: number[] = [];
    const events = await client({ onResponse: (r: Response) => void statuses.push(r.status) })
      .get('/events')
      .sse();
    await events.next();
    events.close();
    expect(statuses).toEqual([200]);
    expect(await serverCancelled()).toBe(true);
  });
});

describe('timeout', () => {
  test('aborts the request instead of leaving it running', async () => {
    let signal: AbortSignal | undefined;
    const slow = new Wrq({
      baseUrl: `http://localhost:${server.port}`,
      hooks: {
        beforeRequest: (options) => {
          signal = (options as RequestInit).signal ?? undefined;
        }
      }
    });
    await expect(slow.get('/slow', { timeout: 20 }).raw()).rejects.toBeInstanceOf(TimeoutError);
    expect(signal?.aborted).toBe(true);
  });

  test("aborts it also when the caller passed a controller, without aborting the caller's", async () => {
    const controller = new AbortController();
    await expect(
      new Wrq({ baseUrl: `http://localhost:${server.port}` }).get('/slow', { timeout: 20, controller }).raw()
    ).rejects.toBeInstanceOf(TimeoutError);
    expect(controller.signal.aborted).toBe(false);
  });
});
