# Wrq == Web Request 

A lightweight web request library for modern runtimes and browsers, built on top of the native `fetch` API.
Designed to be intuitive and easy to use, `wrq` provides a good developer experience for making HTTP requests.

I created this library to simplify HTTP handling in my projects without the overhead of larger libraries and external dependencies.

**WORK IN PROGRESS**: This library is still under development, and while it is functional, it may not yet have all the features you need.

[![npm](https://img.shields.io/npm/v/@fishenv/wrq)](https://www.npmjs.com/package/@fishenv/wrq)

## Features

- **`fetch` API wrapper:** A simple API that wraps the native `fetch` API, making it easier to work with HTTP requests.
- **Instance-based:** Create instances with default configurations (`baseUrl`, `headers`, `timeout`, etc.) to reuse across your application.
- **Hooks:** Hook into the request/response lifecycle to perform actions like logging, authentication, or error handling.
- **Error Handling:** Custom error types for better error handling and debugging.
- **Response Handling:** Easily handle responses as JSON, Blob, raw `Response` objects, or ignore the body entirely.
- **Server-Sent Events:** Read `text/event-stream` responses as an async iterable, with real HTTP errors and explicit close.
- **Cloning:** Create new instances with modified configurations without affecting the original instance.
- **TypeScript Support:** Written in TypeScript for full type safety and autocompletion.

## Installation

```sh
npm install @fishenv/wrq
# or
bun add @fishenv/wrq
```

```typescript
import wrq from '@fishenv/wrq';
```

Since it is a default export you can name it anything you like.

```typescript
import client from '@fishenv/wrq';
...
import http from '@fishenv/wrq';
```

## Usage

### Basic GET Request

The simplest way to use `wrq` is to call the `get` method with a URL:

```typescript
import wrq from '@fishenv/wrq';

const response = await wrq.get('https://example.com').json();

console.log(response);
```

### POST Request with a Body

Sending data with a `POST` request is just as easy. Plain object bodies are automatically serialized with `JSON.stringify`.
`string`, `FormData`, `Blob`, `ArrayBuffer`, `URLSearchParams` and `ReadableStream` bodies are sent as is.
Serialization can be turned off with `json: false` on the instance or per request.

Note that serializing the body does not set a `Content-Type` header; add it yourself (e.g. as an instance default header) if your API requires it.

```typescript
import wrq from '@fishenv/wrq';

const newTodo = {
  title: 'my new todo',
  completed: false,
  userId: 1
};

const response = await wrq.post('https://example.com', newTodo).json();

console.log(response);
```

### Request without response

If you want to make a request without expecting a response body, you can use the `void` method.
This is useful where you don't need the response data or there is no response body.

```typescript
import wrq from '@fishenv/wrq';
await wrq.delete('https://example.com/resource/1').void();
```


### Creating an Instance

You can create an instance of `wrq` with default options that will be applied to all requests made with that instance.

```typescript
import wrq from '@fishenv/wrq';

const jsonPlaceholder = wrq({
  baseUrl: 'https://example.com',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 5000 // 5 seconds
});

const todo = await jsonPlaceholder.get('/todos/1').json();
console.log(todo);

const newTodo = {
  title: 'another todo',
  completed: true,
  userId: 1
};

const createdTodo = await jsonPlaceholder.post('/todos', newTodo).json();
console.log(createdTodo);
```

### Hooks

Hooks allow you to intercept and modify requests and responses. You can use them for logging, adding authentication tokens, or handling errors.
All hooks may be async.

- `beforeRequest(options)`: Runs before the request is sent. The returned options are deep merged into the request options, so you only need to return what you changed (or nothing).
- `onResponse(response)`: Runs when any response is received, before the status is checked.
- `onSuccess(response)`: Runs when the response status is 2xx.
- `onError(error)`: Runs when the request fails, including non-2xx responses (`HttpError`).
- `onTimeout(error)`: Runs instead of `onError` when the request times out.
- `onAbort(error)`: Runs instead of `onError` when the request is aborted with a string reason.

Response hooks receive a response whose body is cloned the first time a hook reads it, so reading the body does not affect the result.
Hooks that only inspect the status or headers do not clone anything, which keeps streaming responses (SSE, large downloads) unbuffered and cancellable.
Read the body while the hook runs; storing the response and reading it later fails once the result has been consumed.
Reading the body of an endless stream (such as SSE) in a hook will block the request until the stream ends.

```typescript
import wrq from '@fishenv/wrq';

const api = wrq({
  baseUrl: 'https://example.com',
  hooks: {
    beforeRequest: (options) => {
      console.log('Sending request with headers:', options.headers);
      // Return only what you want to change, it is deep merged into the request options
      return {
        headers: {
          'X-Request-ID': crypto.randomUUID()
        }
      };
    },
    onSuccess: (response) => {
      console.log('Request successful:', response.status);
    },
    onError: (error) => {
      console.error('Request failed:', error.message);
    }
  }
});

await api.get('/todos/1');
```

### Error Handling

`wrq` provides custom error types to make error handling more specific.

- `HttpError`: Thrown when the response status is not in the 2xx range. Exposes `response` and `options`.
- `TimeoutError`: Thrown when the request exceeds `timeout`. The request is aborted, so its connection is released.
- `AbortError`: Thrown when the request is aborted via `controller.abort('reason')` with a string reason.
- `SseError`: Thrown by `.sse()` when the response is not `text/event-stream`, or an event exceeds `maxEventLength`.
- `WrqError`: The base class of all the errors above.

```typescript
import wrq from '@fishenv/wrq';
import { HttpError, TimeoutError } from '@fishenv/wrq';

try {
  await wrq.get('https://example.com').json();
} catch (error) {
  if (error instanceof HttpError) {
    console.error(`HTTP Error: ${error.response?.status}`);
    const body = await error.response?.text();
    console.error('Response body:', body);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else {
    console.error('An unexpected error occurred:', error);
  }
}
```

### Response Handling

You can handle the response in different ways:

- `.json<T>(transform?)`: Parses the response body as JSON and optionally transforms it with your own function (e.g. a zod schema's `parse`).
- `.blob()`: Returns the response body as a `Blob`.
- `.raw()`: Returns the raw `Response` object.
- `.void()`: Returns void

```typescript
// Get JSON
const user = await wrq.get('https://example.com/users').json<{ name: string }>();
console.log(user.name);

// Get a Blob (e.g., for an image)
const imageBlob = await wrq.get('https://example.com/users/1/thumbnail').blob();
console.log(imageBlob);

// Get the raw Response object
const rawResponse = await wrq.get('https://example.com/users/1').raw();
console.log(rawResponse.headers.get('content-type'));

// Void the response
await wrq.get('https://example.com/users/1').void();
```

### Server-Sent Events

`.sse(options?)` reads a `text/event-stream` response as an async iterable of `{ event, data, id }`. Unlike
`EventSource`, a failed open rejects with the usual errors (`HttpError` with the response, `TimeoutError`), hooks and
instance headers apply, and nothing reconnects by itself.

```typescript
const controller = new AbortController();
const events = await api.get('/events', { controller }).sse({ lastEventId: '41' });

for await (const { event, data, id } of events) {
  if (event === 'end') break; // leaving the loop closes the connection
  console.log(id, JSON.parse(data));
}
```

- Resolves once the response headers have arrived; `timeout` applies to them only, so the stream may run indefinitely.
- Sends `Accept: text/event-stream` (replacing an instance default) and `cache: 'no-store'`; `lastEventId` is sent as
  `Last-Event-ID`.
- Leaving the loop, `events.return()` or `events.close()` closes the connection; a pending `next()` then ends the
  iteration. Aborting the request's `controller` makes the iteration throw an `AbortError`.
- An error after the stream opened (a dropped connection, an event over `maxEventLength`, default 1 MiB) is thrown by the
  iteration and does not run the error hooks: the request itself succeeded.
- Follows the HTML standard's parsing rules (CRLF/LF/CR, comments, `id` carried over to later events, a trailing
  unterminated event discarded). `retry:` is ignored. `parseSse(body)` is exported for bodies from elsewhere.

### Cloning an Instance

You can clone an existing instance to create a new one with a modified configuration. This is useful for creating specialized clients from a base configuration.
The new configuration is deep merged into the existing one, so headers and hooks from the base instance are kept.

```typescript
import wrq from '@fishenv/wrq';

const baseApi = wrq({
  baseUrl: 'https://api.example.com'
});

const authApi = baseApi.clone({
  headers: {
    Authorization: 'Bearer your-token'
  }
});

// This request will have the Authorization header
await authApi.get('/me');
```

## API Reference

### `wrq(options?: WrqOptions): Wrq`

Creates a new `Wrq` instance.

- `options`: An optional configuration object.
  - `name?: string`: Name of the instance, used for debugging (default: a random `wrq_client:xxxxxx` name).
  - `baseUrl?: string`: The base URL for all requests. It is prepended to the request path as is, so request paths must start with `/` and full URLs must be used when no `baseUrl` is set.
  - `headers?: Record<string, string>`: Default headers for all requests. Headers set on a request take precedence.
  - `timeout?: number`: Default timeout in milliseconds (default: 10000).
  - `json?: boolean`: Whether to automatically serialize the request body to JSON (default: true).
  - `hooks?: RequestHooks`: Hooks to intercept requests and responses.

### `wrq.get(path: string, options?: BaseRequestOptions): Handler`

### `wrq.post(path: string, body?: Body, options?: BaseRequestOptions): Handler`

### `wrq.put(path: string, body?: Body, options?: BaseRequestOptions): Handler`

### `wrq.patch(path: string, body?: Body, options?: BaseRequestOptions): Handler`

### `wrq.delete(path: string, options?: BaseRequestOptions): Handler`

### `wrq.head(path: string, options?: BaseRequestOptions): Handler`

### `wrq.options(path: string, options?: BaseRequestOptions): Handler`

These methods initiate a request and return a `Handler` instance that you can use to process the response.
The request is not sent until one of the handler methods is called, and each call sends the request again, which can be used for retries.

`BaseRequestOptions` accepts any `fetch` `RequestInit` option except `method`, `body` and `signal`, plus:

- `json?: boolean`: Override the instance `json` setting for this request.
- `timeout?: number`: Override the instance timeout for this request.
- `controller?: AbortController`: Controller used to abort the request.

### `wrq.clone(options: WrqOptions): Wrq`

Creates a new instance with `options` deep merged into the current instance's configuration.

### `handler.json<T>(transform?: (data: unknown) => T): Promise<T>`

### `handler.blob(): Promise<Blob>`

### `handler.raw(): Promise<Response>`

### `handler.void(): Promise<void>`

### `handler.sse(options?: SseOptions): Promise<EventStream>`

These methods on the `Handler` instance process the response.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
