# Wrq == Web Request 

A lightweight web request library for modern runtimes and browsers, built on top of the native `fetch` API.
Designed to be intuitive and easy to use, `wrq` provides a good developer experience for making HTTP requests.

I created this library to simplify HTTP handling in my projects without the overhead of larger libraries and external dependencies.

**WORK IN PROGRESS**: This library is still under development, and while it is functional, it may not yet have all the features you need.

[![JSR](https://jsr.io/badges/@fishenv/web-request)](https://jsr.io/package/@fishenv/web-request)

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
import wrq from 'jsr:@fishenv/web-request';
```

Since it is a default export you can name it anything you like.

```typescript
import client from 'jsr:@fishenv/web-request';
...
import http from 'jsr:@fishenv/web-request';
```

## Usage

### Basic GET Request

The simplest way to use `wrq` is to call the `get` method with a URL:

```typescript
import wrq from 'jsr:@fishenv/web-request';

const response = await wrq.get('https://jsonplaceholder.typicode.com/todos/1').json();

console.log(response);
```

### POST Request with a Body

Sending data with a `POST` request is just as easy. The body will be automatically serialized to JSON.

```typescript
import wrq from 'jsr:@fishenv/web-request';

const newTodo = {
  title: 'my new todo',
  completed: false,
  userId: 1,
};

const response = await wrq.post('https://jsonplaceholder.typicode.com/todos', newTodo).json();

console.log(response);
```

### Request without response

If you want to make a request without expecting a response body, you can use the `bare` method.
This is useful where you don't need the response data.

```typescript
import wrq from 'jsr:@fishenv/web-request';

const response = await wrq.delete('https://jsonplaceholder.typicode.com/todos/1').bare();

console.log(response);
```


### Creating an Instance

You can create an instance of `wrq` with default options that will be applied to all requests made with that instance.

```typescript
import wrq from 'jsr:@fishenv/web-request';

const jsonPlaceholder = wrq({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000, // 5 seconds
});

const todo = await jsonPlaceholder.get('/todos/1').json();
console.log(todo);

const newTodo = {
  title: 'another todo',
  completed: true,
  userId: 1,
};

const createdTodo = await jsonPlaceholder.post('/todos', newTodo).json();
console.log(createdTodo);
```

### Hooks

Hooks allow you to intercept and modify requests and responses. You can use them for logging, adding authentication tokens, or handling errors.

```typescript
import wrq from 'jsr:@fishenv/web-request';

const api = wrq({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  hooks: {
    beforeRequest: (options) => {
      console.log('Sending request:', options.method, options.url);
      // You can modify options here
      options.headers = {
        ...options.headers,
        'X-Request-ID': crypto.randomUUID(),
      };
      return options;
    },
    onSuccess: (response) => {
      console.log('Request successful:', response.status);
    },
    onError: (error) => {
      console.error('Request failed:', error.message);
    },
  },
});

await api.get('/todos/1');
```

### Error Handling

`wrq` provides custom error types to make error handling more specific.

- `HttpError`: Thrown when the response status is not in the 2xx range.
- `TimeoutError`: Thrown when the request times out.
- `AbortError`: Thrown when the request is aborted.
- `WrqError`: A generic error for other issues.

```typescript
import wrq from 'jsr:@fishenv/web-request';
import { HttpError, TimeoutError } from 'jsr:@fishenv/web-request/errors';

try {
  await wrq.get('https://jsonplaceholder.typicode.com/non-existent-path').json();
} catch (error) {
  if (error instanceof HttpError) {
    console.error(`HTTP Error: ${error.response.status}`);
    const body = await error.response.text();
    console.error('Response body:', body);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else {
    console.error('An unexpected error occurred:', error.message);
  }
}
```

### Response Handling

You can handle the response in different ways:

- `.json<T>()`: Parses the response body as JSON and optionally transforms it.
- `.blob()`: Returns the response body as a `Blob`.
- `.raw()`: Returns the raw `Response` object.
- `.bare()`: Returns void

```typescript
// Get JSON
const user = await wrq.get('https://jsonplaceholder.typicode.com/users/1').json<{ name: string }>();
console.log(user.name);

// Get a Blob (e.g., for an image)
const imageBlob = await wrq.get('https://via.placeholder.com/150').blob();
console.log(imageBlob);

// Get the raw Response object
const rawResponse = await wrq.get('https://jsonplaceholder.typicode.com/users/1').raw();
console.log(rawResponse.headers.get('content-type'));
```

### Cloning an Instance

You can clone an existing instance to create a new one with a modified configuration. This is useful for creating specialized clients from a base configuration.

```typescript
import wrq from 'jsr:@fishenv/web-request';

const baseApi = wrq({
  baseUrl: 'https://api.example.com',
});

const authApi = baseApi.clone({
  headers: {
    Authorization: 'Bearer your-token',
  },
});

// This request will have the Authorization header
await authApi.get('/me');
```

## API Reference

### `wrq(options?: WrqOptions): Wrq`

Creates a new `Wrq` instance.

- `options`: An optional configuration object.
  - `baseUrl?: string`: The base URL for all requests.
  - `headers?: Record<string, string>`: Default headers for all requests.
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
This also allows you to handle retries by calling the handler methods again.

### `handler.json<T>(transform?: (data: unknown) => T): Promise<T>`
### `handler.blob(): Promise<Blob>`
### `handler.raw(): Promise<Response>`

These methods on the `Handler` instance process the response.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
