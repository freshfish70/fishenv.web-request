# wrq

[![JSR](https://jsr.io/badges/@fishenv/wrq)](https://jsr.io/@fishenv/wrq)

A small, dependency-free wrapper around the native `fetch` API for Deno, Node.js, Bun, and browsers.

`wrq` provides reusable clients, request lifecycle hooks, per-request timeouts, and a lazy response handler for JSON,
blobs, raw responses, or requests whose body you want to ignore.

## Installation

Add the package to a Deno project:

```sh
deno add jsr:@fishenv/wrq
```

Then import its default export:

```ts
import wrq from '@fishenv/wrq';
```

You can also import it directly without adding it to `deno.json`:

```ts
import wrq from 'jsr:@fishenv/wrq@^0.2.3';
```

## Quick Start

```ts
import wrq from 'jsr:@fishenv/wrq@^0.2.3';

type Todo = {
  id: number;
  title: string;
  completed: boolean;
};

const api = wrq({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  headers: {
    Accept: 'application/json'
  }
});

const todo = await api.get('/todos/1').json<Todo>();
console.log(todo.title);
```

Calling an HTTP method creates a handler; it does not send the request. The request runs when you call and await one of
`.json()`, `.blob()`, `.raw()`, or `.void()`.

## Sending Data

`post`, `put`, and `patch` accept a standard
[`BodyInit`](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest_API/Sending_and_Receiving_Binary_Data#bodyinit)
value. Set the content type and serialize JSON explicitly:

```ts
const api = wrq({
  baseUrl: 'https://example.com/api',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
});

const created = await api.post(
  '/todos',
  JSON.stringify({ title: 'Write documentation', completed: false })
).json<{ id: number; title: string; completed: boolean }>();
```

Headers supplied to an individual request override client headers with the same key:

```ts
const response = await api.get('/todos', {
  headers: { Authorization: 'Bearer token' },
  timeout: 5_000
}).raw();
```

The request options support standard `RequestInit` properties except `method`, `body`, and `signal`. The per-request
`timeout` defaults to 10 seconds. Use `controller` instead of `signal` when a request needs to be cancellable:

```ts
const controller = new AbortController();
const pending = api.get('/slow', { controller }).json();

controller.abort();
await pending;
```

## Reading Responses

Every HTTP method returns a handler with four execution methods:

| Method | Result |
| --- | --- |
| `.json<T>(transform?)` | Parses JSON and optionally maps the parsed value with `transform` |
| `.blob()` | Resolves with a `Blob` |
| `.raw()` | Resolves with the native `Response` |
| `.void()` | Waits for completion and ignores the response body |

A non-2xx response rejects all four methods. Calling an execution method again sends the request again, which can be
used for simple manual retries:

```ts
const request = api.get('/status');

try {
  await request.void();
} catch {
  await request.void();
}
```

## Hooks

Hooks may be synchronous or asynchronous. `beforeRequest` may mutate its options or return partial replacement options;
the result is deeply merged into the request.

```ts
const api = wrq({
  baseUrl: 'https://example.com/api',
  hooks: {
    beforeRequest: (options) => ({
      headers: {
        ...options.headers,
        'X-Request-ID': crypto.randomUUID()
      }
    }),
    onResponse: (response) => {
      console.log('Received', response.status);
    },
    onSuccess: (response) => {
      console.log('Successful', response.status);
    },
    onError: (error) => {
      console.error(error.message);
    },
    onTimeout: (error) => {
      console.error(error.message);
    }
  }
});

await api.get('/todos/1').void();
```

For a received response, `onResponse` runs first. A 2xx response then runs `onSuccess`; a non-2xx response runs
`onError`. Timeout failures run `onTimeout`, while native abort failures run `onError`. Response hooks receive a clone,
so reading its body does not consume the response returned to the handler.

## Cloning Clients

`clone` creates a new client by deeply merging new options into the current configuration. The original client remains
unchanged, and nested headers and hooks that are not replaced are preserved.

```ts
const baseApi = wrq({
  baseUrl: 'https://example.com/api',
  headers: { Accept: 'application/json' }
});

const authenticatedApi = baseApi.clone({
  headers: { Authorization: 'Bearer token' }
});

await authenticatedApi.get('/me').json();
```

## API Reference

### Client options

| Option | Type | Description |
| --- | --- | --- |
| `baseUrl` | `string` | Prefix concatenated with every request path |
| `headers` | `Record<string, string>` | Headers applied unless overridden by a request |
| `hooks` | `RequestHooks` | Request, response, and error lifecycle callbacks |
| `json` | `boolean` | JSON-stringify non-native body values; defaults to `true` |
| `name` | `string` | Optional client name |

When using `baseUrl`, manage the boundary slash explicitly; the value and path are concatenated as written.

### Request methods

```text
get(path: string, options?: BaseRequestOptions): Handler
delete(path: string, options?: BaseRequestOptions): Handler
head(path: string, options?: BaseRequestOptions): Handler
options(path: string, options?: BaseRequestOptions): Handler

post(path: string, body?: BodyInit, options?: BaseRequestOptions): Handler
put(path: string, body?: BodyInit, options?: BaseRequestOptions): Handler
patch(path: string, body?: BodyInit, options?: BaseRequestOptions): Handler
```

The default export is both callable (`wrq(options)`) and preconfigured with these request methods, so one-off requests
can be made directly:

```ts
const response = await wrq.get('https://example.com').raw();
```

## License

[MIT](./LICENSE)
