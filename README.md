# Wrq == Web Request

A lightweight web request library for modern runtimes and browsers, built on top of the native `fetch` API.
Designed to be intuitive and easy to use, `wrq` provides a good developer experience for making HTTP requests.

[![JSR](https://jsr.io/badges/@fishenv/wrq)](https://jsr.io/@fishenv/wrq)

## Features

- **`fetch` API wrapper:** A simple API that wraps the native `fetch` API, making it easier to work with HTTP requests.
- **Instance-based:** Create instances with default configurations (`baseUrl`, `headers`, `timeout`, etc.) to reuse across your application.
- **Hooks:** Hook into the request/response lifecycle to perform actions like logging, authentication, or error handling.
- **Error Handling:** Custom error types for better error handling and debugging.
- **Response Handling:** Easily handle responses as JSON, Blob, or raw `Response` objects.
- **Cloning:** Create new instances with modified configurations without affecting the original instance.
- **TypeScript Support:** Written in TypeScript for full type safety and autocompletion.

## Installation

```typescript
import wrq from 'jsr:@fishenv/wrq';
```

Since it is a default export you can name it anything you like.

```typescript
import client from 'jsr:@fishenv/wrq';
// ...
import http from 'jsr:@fishenv/wrq';
```

## Usage

### Basic GET Request

The simplest way to use `wrq` is to call the `get` method with a URL:

```typescript
import wrq from 'jsr:@fishenv/wrq';

const response = await wrq.get('https://example.com').json();

console.log(response);
```

### POST Request with a Body

Sending data with a `POST` request is just as easy. Plain objects are automatically serialized to JSON when `json` is `true` (the default).

```typescript
import wrq from 'jsr:@fishenv/wrq';

const newTodo = {
  title: 'my new todo',
  completed: false,
  userId: 1,
};

const response = await wrq.post('https://example.com', JSON.stringify(newTodo)).json();

console.log(response);
```

### Request without a Response Body

If you want to make a request without expecting a response body, you can use the `void` method.
This is useful where you don't need the response data or there is no response body.

```typescript
import wrq from 'jsr:@fishenv/wrq';
await wrq.delete('https://example.com/resource/1').void();
```

### Creating an Instance

You can create an instance of `wrq` with default options that will be applied to all requests made with that instance.

```typescript
import wrq from 'jsr:@fishenv/wrq';

const jsonPlaceholder = wrq({
  baseUrl: 'https://example.com',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000, // 5 seconds
});

const todo = await jsonPlaceholder.get('/todos/1').json();
console.log(todo);

const createdTodo = await jsonPlaceholder.post('/todos', JSON.stringify({
  title: 'another todo',
  completed: true,
  userId: 1,
})).json();
console.log(createdTodo);
```

### Hooks

Hooks allow you to intercept and modify requests and responses. You can use them for logging, adding authentication tokens, or handling errors.

The `beforeRequest` hook receives the current request options and its return value is **deep-merged** with the original options, so you only need to return the properties you want to change.

```typescript
import wrq from 'jsr:@fishenv/wrq';

const api = wrq({
  baseUrl: 'https://example.com',
  hooks: {
    beforeRequest: (options) => {
      // Return only the properties you want to override — they are deep-merged.
      return {
        headers: {
          ...options.headers as Record<string, string>,
          'X-Request-ID': crypto.randomUUID(),
        },
      };
    },
    onResponse: (response) => {
      // Runs for every response (before success/error branching).
      // Receives a clone of the response to avoid consuming the body.
      console.log('Response received:', response.status);
    },
    onSuccess: (response) => {
      // Runs after a successful (2xx) response, before the result is returned.
      // Receives a clone of the response.
      console.log('Request successful:', response.status);
    },
    onError: (error) => {
      console.error('Request failed:', error.message);
    },
    onTimeout: (error) => {
      console.error('Request timed out:', error.message);
    },
    onAbort: (error) => {
      console.error('Request aborted:', error.message);
    },
  },
});

await api.get('/todos/1').json();
```

### Error Handling

`wrq` provides custom error types to make error handling more specific. All error classes extend `WrqError`, which extends the native `Error`.

- `HttpError`: Thrown when the response status is not in the 2xx range. Exposes a `response` property with the original `Response` object.
- `TimeoutError`: Thrown when the request exceeds the configured timeout.
- `AbortError`: Thrown when the request is aborted.
- `WrqError`: Base error class for all `wrq` errors.

```typescript
import wrq from 'jsr:@fishenv/wrq';
import { HttpError, TimeoutError, AbortError, WrqError } from 'jsr:@fishenv/wrq';

try {
  await wrq.get('https://example.com').json();
} catch (error) {
  if (error instanceof HttpError) {
    console.error(`HTTP Error: ${error.response?.status}`);
    const body = await error.response?.text();
    console.error('Response body:', body);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else if (error instanceof AbortError) {
    console.error('Request was aborted');
  } else if (error instanceof WrqError) {
    console.error('An unexpected wrq error occurred:', error.message);
  }
}
```

### Response Handling

You can handle the response in different ways:

- `.json<T>(transform?)`: Parses the response body as JSON. An optional transform function can be applied to the parsed data before it is returned.
- `.blob()`: Returns the response body as a `Blob`.
- `.raw()`: Returns the raw `Response` object.
- `.void()`: Executes the request and discards the response body.

```typescript
// Get JSON
const user = await wrq.get('https://example.com/users/1').json<{ name: string }>();
console.log(user.name);

// Get JSON with a transform (e.g. validation with zod or class-transformer)
import { z } from 'npm:zod';
const UserSchema = z.object({ name: z.string() });
const validatedUser = await wrq.get('https://example.com/users/1').json((data) => UserSchema.parse(data));

// Get a Blob (e.g., for an image)
const imageBlob = await wrq.get('https://example.com/users/1/thumbnail').blob();
console.log(imageBlob);

// Get the raw Response object
const rawResponse = await wrq.get('https://example.com/users/1').raw();
console.log(rawResponse.headers.get('content-type'));

// Discard the response body
await wrq.delete('https://example.com/users/1').void();
```

### Cloning an Instance

You can clone an existing instance to create a new one with a modified configuration. The provided options are **deep-merged** with the original instance's configuration, so only the properties you want to change need to be specified.

```typescript
import wrq from 'jsr:@fishenv/wrq';

const baseApi = wrq({
  baseUrl: 'https://api.example.com',
});

const authApi = baseApi.clone({
  headers: {
    Authorization: 'Bearer your-token',
  },
});

// This request will include the Authorization header alongside any headers already on baseApi.
await authApi.get('/me').json();
```

### Aborting a Request

You can pass a custom `AbortController` per request to cancel it programmatically.

```typescript
import wrq from 'jsr:@fishenv/wrq';

const controller = new AbortController();

setTimeout(() => controller.abort(), 2000); // abort after 2 s

await wrq.get('https://example.com/slow-endpoint', { controller }).json();
```

---

## API Reference

### `wrq(options?: WrqOptions): WrqInstance`

Factory function — creates a new `WrqInstance`. Can also be called directly as `wrq.get(...)` etc. using a shared default instance.

#### `WrqOptions`

| Property  | Type             | Default    | Description |
|-----------|------------------|------------|-------------|
| `name`    | `string`         | auto-generated | A human-readable label for the instance, used in logging and debugging. |
| `baseUrl` | `string`         | `''`       | Base URL prepended to every request path. |
| `headers` | `Record<string, string>` | `{}` | Default headers added to every request. Per-request headers take precedence. |
| `timeout` | `number`         | `10000`    | Default request timeout in milliseconds. |
| `json`    | `boolean`        | `true`     | When `true`, plain objects passed as a body are automatically `JSON.stringify`-ed. |
| `hooks`   | `RequestHooks`   | —          | Lifecycle hooks (see below). |

#### `RequestHooks`

| Hook             | Signature | Description |
|------------------|-----------|-------------|
| `beforeRequest`  | `(options: BaseRequestOptions) => BaseRequestOptions \| Promise<BaseRequestOptions> \| void` | Runs before the request is sent. The return value is **deep-merged** with the original options, so only modified properties need to be returned. |
| `onResponse`     | `(response: Response) => void \| Promise<void>` | Runs for every response before the 2xx check. Receives a **clone** of the response. |
| `onSuccess`      | `(response: Response) => void \| Promise<void>` | Runs after a 2xx response, before the result is returned. Receives a **clone** of the response. |
| `onError`        | `(error: Error) => void \| Promise<void>` | Runs when any non-timeout, non-abort error occurs. |
| `onTimeout`      | `(error: Error) => void \| Promise<void>` | Runs when the request exceeds the configured timeout. |
| `onAbort`        | `(error: Error) => void \| Promise<void>` | Runs when the request is aborted. |

---

### Request Methods

All methods return a `Handler` instance. Chain a response method (`.json()`, `.blob()`, `.raw()`, `.void()`) to execute the request.

```
wrq.get(path: string, options?: BaseRequestOptions): Handler
wrq.post(path: string, body?: BodyInit, options?: BaseRequestOptions): Handler
wrq.put(path: string, body?: BodyInit, options?: BaseRequestOptions): Handler
wrq.patch(path: string, body?: BodyInit, options?: BaseRequestOptions): Handler
wrq.delete(path: string, options?: BaseRequestOptions): Handler
wrq.head(path: string, options?: BaseRequestOptions): Handler
wrq.options(path: string, options?: BaseRequestOptions): Handler
```

#### `BaseRequestOptions`

Extends the standard `RequestInit` (minus `method`, `body`, and `signal`) with the following additional properties:

| Property     | Type              | Description |
|--------------|-------------------|-------------|
| `json`       | `boolean`         | Overrides the instance-level `json` setting for this request. |
| `timeout`    | `number`          | Overrides the instance-level `timeout` for this request (in milliseconds). |
| `controller` | `AbortController` | A custom `AbortController` to allow manual request cancellation. |

---

### Handler Methods

```
handler.json<T>(transform?: (data: unknown) => T): Promise<T>
handler.blob(): Promise<Blob>
handler.raw(): Promise<Response>
handler.void(): Promise<void>
```

| Method       | Description |
|--------------|-------------|
| `json<T>(transform?)` | Executes the request and parses the response body as JSON. An optional `transform` function (e.g. a Zod schema parser) is applied to the raw parsed value before returning. |
| `blob()`     | Executes the request and returns the response body as a `Blob`. |
| `raw()`      | Executes the request and returns the native `Response` object. |
| `void()`     | Executes the request and discards the response body. Useful for fire-and-forget calls. |

---

### `instance.clone(options: WrqOptions): WrqInstance`

Returns a **new** `WrqInstance` whose configuration is the result of deep-merging the provided `options` into the current instance's configuration. The original instance is not mutated.

---

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
