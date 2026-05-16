import { Handler } from './handler.ts';
import { deepMerge } from './helpers/mod.ts';
import type { BaseRequestOptions, Body, RequestMethod, WrqInstance, WrqOptions } from './types.ts';

export class Wrq implements WrqInstance {
  #config: WrqOptions = {};

  constructor(config: WrqOptions = {}) {
    this.#config = config;

    if (config.json === undefined) {
      this.#config.json = true;
    }

    if (!config.name) {
      this.#config.name = `wrq_client:${Math.random().toString(16).substring(2, 8)}`;
    }
  }

  get name(): string {
    return this.#config.name || 'wrq';
  }

  /**
   * Transforms the body of the request to be compatible with fetch.
   * If the body is an object and `transformJson` is true, it converts the body to a JSON string.
   * If the body is already a string, it returns it as is.
   * If the body is undefined or null, it returns null.
   * @param body - The body of the request, which can be an object, string, undefined, or null.
   * @param transformJson - A boolean indicating whether to transform the body to JSON.
   * @returns The transformed body, which is a string if `transformJson` is true and the body is an object, or the original body if it is a string.
   * If the body is undefined or null, it returns null.
   */
  #transformBody(body?: BodyInit, transformJson: boolean = true) {
    if (body === undefined || body === null) {
      return null;
    }

    if (
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof ArrayBuffer ||
      body instanceof URLSearchParams ||
      body instanceof ReadableStream ||
      typeof body === 'string'
    ) {
      return body;
    }

    return transformJson ? JSON.stringify(body) : body;
  }

  #toHandler({
    path,
    method,
    options,
    body
  }: {
    path: string;
    method: RequestMethod;
    options?: BaseRequestOptions;
    body?: BodyInit;
  }): Handler {
    let transformJson = this.#config.json;

    if (options?.json !== undefined) {
      transformJson = options.json;
    }

    /**
     * Set default headers from the Wrq instance configuration if they are not already set in the request options.
     * Always initialize headers as a plain object so the beforeRequest hook can safely read and mutate it.
     */
    options = options || {};
    options.headers = (options.headers || {}) as Record<string, string>;

    Object.entries(this.#config.headers || {}).forEach(([key, value]) => {
      if ((options.headers as Record<string, string>)[key] === undefined) {
        (options.headers as Record<string, string>)[key] = value;
      }
    });

    return new Handler({
      ...this.#config,
      request: {
        path,
        options: {
          ...options,
          method,
          body: this.#transformBody(body, transformJson)
        }
      }
    });
  }

  get(path: string, options?: BaseRequestOptions): Handler {
    return this.#toHandler({ method: 'GET', path, options });
  }

  options(path: string, options?: BaseRequestOptions): Handler {
    return this.#toHandler({ method: 'OPTIONS', path, options });
  }

  head(path: string, options?: BaseRequestOptions): Handler {
    return this.#toHandler({ method: 'HEAD', path, options });
  }

  delete(path: string, options?: BaseRequestOptions): Handler {
    return this.#toHandler({ method: 'DELETE', path, options });
  }

  post(path: string, body?: Body, options?: BaseRequestOptions): Handler {
    return this.#toHandler({ method: 'POST', path, options, body });
  }

  put(path: string, body?: Body, options?: BaseRequestOptions): Handler {
    return this.#toHandler({ method: 'PUT', path, options, body });
  }

  patch(path: string, body?: Body, options?: BaseRequestOptions): Handler {
    return this.#toHandler({ method: 'PATCH', path, options, body });
  }

  /**
   * Creates a new instance of Wrq with the provided configuration.
   * This method allows you to create a new instance with a different configuration
   * without modifying the original instance.
   * @param config - The configuration options to merge with the current instance.
   * @returns A new instance of Wrq with the merged configuration.
   */
  clone(config: WrqOptions): Wrq {
    return new Wrq(deepMerge(this.#config, config));
  }
}
