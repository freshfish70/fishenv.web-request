import { AbortError, HttpError, TimeoutError, WrqError } from './errors/mod.ts';
import { deepMerge, lazyClone, logger } from './helpers/mod.ts';
import type { SseParseOptions } from './sse/parse.ts';
import { type EventStream, eventStream } from './sse/stream.ts';
import type { ErrorHook, InternalRequestOptions, ResponseHook, WrqOptions } from './types.ts';

export type SseOptions = SseParseOptions & {
  /**
   * Sent as the `Last-Event-ID` header, to resume a stream after reconnecting.
   */
  lastEventId?: string;
};

type HandlerOptions = WrqOptions & {
  log?: boolean;
  request: {
    options: InternalRequestOptions;
    path: string;
  };
};

export class Handler {
  /**
   * Default timeout for requests in milliseconds.
   * @default 10000 (10 seconds)
   */
  private readonly TIMEOUT_DEFAULT = 10_000;

  #config: HandlerOptions;

  constructor(config: HandlerOptions) {
    this.#config = config;
  }

  #requestUrl(path: string): URL {
    return new URL(`${this.#config.baseUrl || ''}${path}`);
  }

  async #beforeRequestHook(options: InternalRequestOptions) {
    this.#config.log && logger.log('Try run before request hook');

    const hookResult = this.#config.hooks?.beforeRequest?.(options);
    const newOptions = hookResult instanceof Promise ? await hookResult : hookResult;
    this.#config.log && logger.log('Before request hook done');
    return deepMerge(options, newOptions as Partial<InternalRequestOptions>);
  }

  async #responseHook(response: Response, hookName: ResponseHook) {
    this.#config.log && logger.log(`Try run response hook: ${hookName}`);
    const hookResult = this.#config.hooks?.[hookName]?.(lazyClone(response));
    if (hookResult instanceof Promise) {
      await hookResult;
    }
    this.#config.log && logger.log('Response hook done');
  }

  async #errorHook(error: Error, hookName: ErrorHook) {
    this.#config.log && logger.log(`Try run error hook: ${hookName}`);
    const hook = this.#config.hooks?.[hookName]?.(error);

    if (hook instanceof Promise) {
      await hook;
    }

    this.#config.log && logger.log(`Error hook done`);
  }

  /**
   * @param abort - Aborts the request: on timeout, and by `sse()` when the stream is closed. The caller's
   * `controller` aborts it too.
   */
  async #request(path: string, options: InternalRequestOptions, abort = new AbortController()) {
    try {
      this.#config.log && logger.log('Starting request', path, options);
      const url = this.#requestUrl(path);

      const { timeout, controller } = options;
      options.signal = controller ? AbortSignal.any([controller.signal, abort.signal]) : abort.signal;
      options = await this.#beforeRequestHook(options);

      const response = await new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => {
          const error = new TimeoutError({ options });
          reject(error);
          // Without this the request keeps running, and its connection stays open, after the caller gave up
          abort.abort(error);
        }, timeout || this.TIMEOUT_DEFAULT);

        fetch(url, options)
          .then(resolve)
          .catch(reject)
          .finally(() => clearTimeout(timer));
      });

      await this.#responseHook(response, 'onResponse');
      if (!response.ok) {
        this.#config.log && logger.warn(`Request failed with status ${response.status}`);
        throw new HttpError({ options, response });
      } else {
        await this.#responseHook(response, 'onSuccess');
      }

      return response;
    } catch (error) {
      let _error = error;

      let hookType: ErrorHook = 'onError';
      if (_error instanceof TimeoutError) {
        hookType = 'onTimeout';
      } else if (typeof _error === 'string') {
        _error = new AbortError(_error, { options });
        hookType = 'onAbort';
      }

      await this.#errorHook(_error as Error, hookType);

      throw _error;
    }
  }

  /**
   * Executes the request and returns the response as JSON with provided type.
   * A transformation function can be applied to the result before returning it.
   * This method is useful for parsing the response body as JSON
   * and applying any necessary transformations to the data, like zod and class-transformer.
   *
   * @param {Function} [transform] - Optional transformation function to apply to the JSON data.
   * @return {Promise<T>} A promise that resolves to the transformed JSON data.
   * @throws {WrqError} If no response is received from the request.
   * @throws {HttpError} If the response status is not OK (2xx).
   * @throws {TimeoutError} If the request times out.
   * @throws {AbortError} If the request is aborted or any other error occurs.
   */
  async json<T>(transform?: (data: unknown) => T): Promise<T> {
    const response = await this.#request(this.#config.request.path, this.#config.request.options);
    if (!response) {
      throw new WrqError('No response received from request');
    }

    const j = await response.json();
    return (transform ? transform(j) : j) as T;
  }

  /**
   * Executes the request without returning any data.
   * This method is useful for requests where you do not need to process the response body,
   *
   * @return {Promise<void>} A promise that resolves to void.
   * @throws {WrqError} If no response is received from the request.
   * @throws {HttpError} If the response status is not OK (2xx).
   * @throws {TimeoutError} If the request times out.
   * @throws {AbortError} If the request is aborted or any other error occurs.
   */
  async void(): Promise<void> {
    await this.#request(this.#config.request.path, this.#config.request.options);
  }

  /**
   * Executes the request and returns the response blob.
   *
   * @return {Promise<T>} A promise that resolves to the transformed JSON data.
   * @throws {WrqError} If no response is received from the request.
   * @throws {HttpError} If the response status is not OK (2xx).
   * @throws {TimeoutError} If the request times out.
   * @throws {AbortError} If the request is aborted or any other error occurs.
   */
  async blob(): Promise<Blob> {
    const response = await this.#request(this.#config.request.path, this.#config.request.options);
    if (!response) {
      throw new WrqError('No response received from request');
    }
    return await response.blob();
  }

  /**
   * Executes the request and returns the raw response object.
   * This is the native Response object.
   *
   * @return {Promise<T>} A promise that resolves to the transformed JSON data.
   * @throws {WrqError} If no response is received from the request.
   * @throws {HttpError} If the response status is not OK (2xx).
   * @throws {TimeoutError} If the request times out.
   * @throws {AbortError} If the request is aborted or any other error occurs.
   */
  async raw(): Promise<Response> {
    const result = await this.#request(this.#config.request.path, this.#config.request.options);

    if (!result) {
      throw new WrqError('No response received from request');
    }

    return result;
  }

  /**
   * Executes the request and reads the response as Server-Sent Events.
   * Resolves once the response headers have arrived; the timeout applies to them only, so the stream itself may run
   * indefinitely. Sends `Accept: text/event-stream` and `cache: 'no-store'`.
   *
   * Leaving the loop, `return()` or `close()` closes the connection. Aborting the request's `controller` makes the
   * iteration throw an `AbortError`. Nothing reconnects by itself; resume with `lastEventId` if the server supports it.
   * An error after the stream has opened (such as a dropped connection) is thrown by the iteration and does not run
   * the error hooks: the request itself succeeded.
   *
   * @param {SseOptions} [options] - Parser limits and `lastEventId`.
   * @return {Promise<EventStream>} A promise that resolves to an async iterable of events.
   * @throws {HttpError} If the response status is not OK (2xx).
   * @throws {SseError} If the response is not `text/event-stream`.
   * @throws {TimeoutError} If the response headers do not arrive in time.
   * @throws {AbortError} If the request is aborted or any other error occurs.
   */
  async sse(options: SseOptions = {}): Promise<EventStream> {
    const { lastEventId, ...parse } = options;
    const request = this.#config.request.options;
    // The method decides what it accepts, so a default `Accept` header of the instance is replaced, in any casing
    const headers = Object.fromEntries(
      Object.entries((request.headers ?? {}) as Record<string, string>).filter(
        ([key]) => key.toLowerCase() !== 'accept'
      )
    );
    headers.Accept = 'text/event-stream';
    if (lastEventId !== undefined) {
      headers['Last-Event-ID'] = lastEventId;
    }

    const abort = new AbortController();
    const requestOptions: InternalRequestOptions = { cache: 'no-store', ...request, headers };
    const response = await this.#request(this.#config.request.path, requestOptions, abort);
    return eventStream({ response, abort, controller: request.controller, options: requestOptions, parse });
  }
}
