import { logger } from './helpers/mod.ts';
import { AbortError, HttpError, TimeoutError, WrqError } from './errors/mod.ts';
import type { ErrorHook, InternalRequestOptions, ResponseHook, WrqOptions } from './types.ts';

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
    // TODO: Deep merge
    return {
      ...options,
      ...newOptions
    };
  }

  async #responseHook(response: Response, hookName: ResponseHook) {
    this.#config.log && logger.log(`Try run response hook: ${hookName}`);
    const hookResult = this.#config.hooks?.[hookName]?.(response.clone());
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

  async #request(path: string, options: InternalRequestOptions) {
    try {
      this.#config.log && logger.log('Starting request', path, options);
      const url = this.#requestUrl(path);

      const { timeout, controller } = options;
      options.signal = controller ? controller.signal : new AbortController().signal;
      options = await this.#beforeRequestHook(options);

      const response = await new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new TimeoutError({ options }));
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
  async bare(): Promise<void> {
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
}
