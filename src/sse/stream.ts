import { AbortError, SseError } from '../errors/mod.ts';
import type { BaseRequestOptions } from '../types.ts';
import { parseSse, type SseEvent, type SseParseOptions } from './parse.ts';

/**
 * The events of one SSE response. Iterate it with `for await`; leaving the loop, `return()` or `close()` closes the
 * connection.
 */
export type EventStream = AsyncIterableIterator<SseEvent> & {
  /**
   * Closes the connection. A pending or later `next()` ends the iteration normally.
   */
  close: () => void;
};

type EventStreamArgs = {
  response: Response;
  /**
   * Aborts the request: closing the stream aborts it so the connection is released even if a hook still holds a
   * clone of the body.
   */
  abort: AbortController;
  /**
   * The caller's controller; when it aborts, the iteration throws an `AbortError`.
   */
  controller?: AbortController;
  options: BaseRequestOptions;
  parse: SseParseOptions;
};

/**
 * Wraps a successful response as an `EventStream`.
 *
 * @throws {SseError} If the response is not `text/event-stream`; the connection is closed first.
 */
export function eventStream({ response, abort, controller, options, parse }: EventStreamArgs): EventStream {
  const type = response.headers.get('content-type') ?? '';
  if (!response.body || !type.toLowerCase().startsWith('text/event-stream')) {
    abort.abort();
    throw new SseError(`Expected text/event-stream, got ${type || 'no content type'}`);
  }

  const body = response.body;
  let closed = false;
  const close = () => {
    closed = true;
    abort.abort();
  };

  async function* events(): AsyncGenerator<SseEvent, void, undefined> {
    try {
      yield* parseSse(body, parse);
    } catch (error) {
      if (closed) {
        return;
      }
      if (controller?.signal.aborted) {
        throw new AbortError(String(controller.signal.reason ?? 'aborted'), { options });
      }
      throw error;
    } finally {
      abort.abort();
    }
  }

  // A plain generator skips its `finally` when `return()` is called before the first `next()`; this wrapper
  // closes the connection in every case
  const inner = events();
  const stream: EventStream = {
    next: () => inner.next(),
    return: async () => {
      close();
      await inner.return(undefined);
      return { done: true, value: undefined };
    },
    throw: async (error?: unknown) => {
      close();
      return inner.throw(error);
    },
    close,
    [Symbol.asyncIterator]: () => stream
  };
  return stream;
}
