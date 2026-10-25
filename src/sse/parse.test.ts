import { describe, expect, test } from 'bun:test';
import { SseError } from '../errors/mod.ts';
import { parseSse, type SseEvent } from './parse.ts';

const encoder = new TextEncoder();

function bodyOf(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    }
  });
}

function collect(chunks: (string | Uint8Array)[]): Promise<SseEvent[]> {
  return Array.fromAsync(parseSse(bodyOf(chunks)));
}

describe('parseSse', () => {
  test('events, named events, multi-line data and comments', async () => {
    expect(await collect([': hello\n\ndata: a\n\nevent: end\ndata: x\ndata: y\n\n'])).toEqual([
      { event: 'message', data: 'a', id: '' },
      { event: 'end', data: 'x\ny', id: '' }
    ]);
  });

  test('CRLF, CR and LF line ends, also split across chunks', async () => {
    const events = await collect(['data: a\r', '\n\r', '\ndata: b\r\rdata: c\n', '\n']);
    expect(events.map((e) => e.data)).toEqual(['a', 'b', 'c']);
  });

  test('a multi-byte character split across chunks', async () => {
    const bytes = encoder.encode('data: ø\n\n');
    expect(await collect([bytes.slice(0, 7), bytes.slice(7)])).toEqual([{ event: 'message', data: 'ø', id: '' }]);
  });

  test('id carries over to later events; an id containing NUL is ignored', async () => {
    const events = await collect(['id: 1\ndata: a\n\ndata: b\n\nid: 2\0x\ndata: c\n\n']);
    expect(events.map((e) => e.id)).toEqual(['1', '1', '1']);
  });

  test('strips one space after the colon; a field without a colon has an empty value', async () => {
    expect(await collect(['data:  two\ndata\n\n'])).toEqual([{ event: 'message', data: ' two\n', id: '' }]);
  });

  test('a leading BOM is skipped', async () => {
    expect(await collect(['﻿data: a\n\n'])).toEqual([{ event: 'message', data: 'a', id: '' }]);
  });

  test('an event without data is not dispatched; an unterminated event at the end is discarded', async () => {
    expect(await collect(['event: ping\n\ndata: a\n\ndata: b\n'])).toEqual([{ event: 'message', data: 'a', id: '' }]);
  });

  test('an oversized event is rejected', async () => {
    const events = parseSse(bodyOf([`data: ${'x'.repeat(100)}\n`]), { maxEventLength: 50 });
    await expect(Array.fromAsync(events)).rejects.toBeInstanceOf(SseError);
  });

  test('an unterminated line counts toward the limit', async () => {
    const events = parseSse(bodyOf(['data: ', 'x'.repeat(100)]), { maxEventLength: 50 });
    await expect(Array.fromAsync(events)).rejects.toBeInstanceOf(SseError);
  });

  test('stopping early cancels the body', async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull: (controller) => controller.enqueue(encoder.encode('data: a\n\n')),
      cancel: () => {
        cancelled = true;
      }
    });
    for await (const _ of parseSse(body)) {
      break;
    }
    expect(cancelled).toBe(true);
  });
});
