import { assertEquals, assertInstanceOf } from 'jsr:@std/assert';
import { WrqError } from './WrqError.ts';
import { HttpError } from './HttpError.ts';
import { TimeoutError } from './TimeoutError.ts';
import { AbortError } from './AbortError.ts';

// ---------------------------------------------------------------------------
// WrqError
// ---------------------------------------------------------------------------

Deno.test('WrqError', async (t) => {
  await t.step('is an instance of Error', () => {
    assertInstanceOf(new WrqError('msg'), Error);
  });

  await t.step('name is "WrqError"', () => {
    assertEquals(new WrqError('msg').name, 'WrqError');
  });

  await t.step('stores the message', () => {
    assertEquals(new WrqError('something went wrong').message, 'something went wrong');
  });
});

// ---------------------------------------------------------------------------
// HttpError
// ---------------------------------------------------------------------------

Deno.test('HttpError', async (t) => {
  await t.step('is an instance of WrqError', () => {
    assertInstanceOf(new HttpError({ options: {} }), WrqError);
  });

  await t.step('name is "WrqHttpError"', () => {
    assertEquals(new HttpError({ options: {} }).name, 'WrqHttpError');
  });

  await t.step('stores the response', () => {
    const response = new Response(null, { status: 404, statusText: 'Not Found' });
    const err = new HttpError({ response, options: {} });
    assertEquals(err.response, response);
  });

  await t.step('stores the options', () => {
    const options = { timeout: 5000 };
    const err = new HttpError({ options });
    assertEquals(err.options, options);
  });

  await t.step('message includes the status code', () => {
    const response = new Response(null, { status: 404, statusText: 'Not Found' });
    const err = new HttpError({ response, options: {} });
    assertEquals(err.message.includes('404'), true);
  });

  await t.step('message includes the status text', () => {
    const response = new Response(null, { status: 500, statusText: 'Internal Server Error' });
    const err = new HttpError({ response, options: {} });
    assertEquals(err.message.includes('Internal Server Error'), true);
  });

  await t.step('message shows status 0 when response is undefined', () => {
    const err = new HttpError({ options: {} });
    assertEquals(err.message.includes('0'), true);
    assertEquals(err.response, undefined);
  });
});

// ---------------------------------------------------------------------------
// TimeoutError
// ---------------------------------------------------------------------------

Deno.test('TimeoutError', async (t) => {
  await t.step('is an instance of WrqError', () => {
    assertInstanceOf(new TimeoutError({ options: { timeout: 3000 } }), WrqError);
  });

  await t.step('name is "WrqTimeoutError"', () => {
    assertEquals(new TimeoutError({ options: {} }).name, 'WrqTimeoutError');
  });

  await t.step('stores the options', () => {
    const options = { timeout: 3000 };
    assertEquals(new TimeoutError({ options }).options, options);
  });

  await t.step('message includes the timeout value in ms', () => {
    assertEquals(new TimeoutError({ options: { timeout: 3000 } }).message.includes('3000ms'), true);
  });

  await t.step('message shows 0ms when timeout is not set', () => {
    assertEquals(new TimeoutError({ options: {} }).message.includes('0ms'), true);
  });
});

// ---------------------------------------------------------------------------
// AbortError
// ---------------------------------------------------------------------------

Deno.test('AbortError', async (t) => {
  await t.step('is an instance of WrqError', () => {
    assertInstanceOf(new AbortError('cancelled', { options: {} }), WrqError);
  });

  await t.step('name is "WrqAbortError"', () => {
    assertEquals(new AbortError('cancelled', { options: {} }).name, 'WrqAbortError');
  });

  await t.step('stores the options', () => {
    const options = { timeout: 5000 };
    assertEquals(new AbortError('cancelled', { options }).options, options);
  });

  await t.step('message includes the reason', () => {
    assertEquals(new AbortError('user cancelled', { options: {} }).message.includes('user cancelled'), true);
  });
});
