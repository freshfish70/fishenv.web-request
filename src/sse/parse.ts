import { SseError } from '../errors/mod.ts';

/**
 * Default limit for one event, in characters.
 */
export const DEFAULT_MAX_EVENT_LENGTH = 1024 * 1024;

export type SseEvent = {
  /**
   * The `event:` field, or `message` when the server sent none.
   */
  event: string;
  /**
   * The `data:` lines of the event, joined with `\n`.
   */
  data: string;
  /**
   * The last `id:` seen on this stream (it carries over to later events, as in `EventSource`).
   * Empty before the first id.
   */
  id: string;
};

export type SseParseOptions = {
  /**
   * Characters one event (or one unterminated line) may hold before the stream is rejected with an `SseError`.
   * Defaults to 1 MiB.
   */
  maxEventLength?: number;
};

type EventBuilder = {
  /**
   * Feeds one line; returns the event a blank line completes, if any.
   */
  line: (line: string) => SseEvent | null;
  /**
   * Characters held for the event being built.
   */
  readonly pending: number;
};

function eventBuilder(): EventBuilder {
  let lastId = '';
  let event = '';
  let data = '';
  let hasData = false;

  return {
    get pending() {
      return data.length;
    },
    line(line) {
      if (line === '') {
        const out = hasData ? { event: event || 'message', data, id: lastId } : null;
        event = '';
        data = '';
        hasData = false;
        return out;
      }
      if (line.startsWith(':')) {
        return null;
      }
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) {
        value = value.slice(1);
      }
      if (field === 'event') {
        event = value;
      } else if (field === 'data') {
        data = hasData ? `${data}\n${value}` : value;
        hasData = true;
      } else if (field === 'id' && !value.includes('\0')) {
        lastId = value;
      }
      return null;
    }
  };
}

/**
 * Parses a `text/event-stream` body as the HTML standard describes it (§9.2.6): CRLF, LF or CR line ends,
 * `:` comments, a leading BOM, one optional space after the colon. An event still open when the body ends is
 * discarded. `retry:` is ignored, since reconnecting is the caller's decision.
 *
 * Ending the iteration early cancels the body.
 *
 * @param body - The response body.
 * @param options - Parser limits.
 * @throws {SseError} If one event grows beyond `maxEventLength`.
 */
export async function* parseSse(
  body: ReadableStream<Uint8Array>,
  options: SseParseOptions = {}
): AsyncGenerator<SseEvent, void, undefined> {
  const maxLength = options.maxEventLength ?? DEFAULT_MAX_EVENT_LENGTH;
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  const builder = eventBuilder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const ch = buffer[i];
        if (ch !== '\n' && ch !== '\r') {
          continue;
        }
        // A CR that ends the chunk may be the first half of a CRLF: wait for the next chunk
        if (ch === '\r' && i === buffer.length - 1 && !done) {
          break;
        }
        const event = builder.line(buffer.slice(start, i));
        if (ch === '\r' && buffer[i + 1] === '\n') {
          i++;
        }
        start = i + 1;
        if (event) {
          yield event;
        }
      }
      buffer = buffer.slice(start);
      if (buffer.length + builder.pending > maxLength) {
        throw new SseError(`Event exceeds ${maxLength} characters`);
      }
      if (done) {
        return;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
