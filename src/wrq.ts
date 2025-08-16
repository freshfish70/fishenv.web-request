import type { BaseRequestOptions, Body, RequestMethod, WrqInstance, WrqOptions } from './types.ts';
import { Handler } from './handler.ts';

export class Wrq implements WrqInstance {
  #config: WrqOptions = {};

  constructor(config: WrqOptions = {}) {
    this.#config = config;

    if (config.json === undefined) {
      this.#config.json = true; // Default to true if not specified
    }
  }

  get name() {
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
  #transformBody(body: Body, transformJson: boolean = true) {
    if (typeof body === 'object') {
      return transformJson ? JSON.stringify(body) : body?.toString();
    }

    return body;
  }

  #toHandler({ path, method, options, body }: {
    path: string;
    method: RequestMethod;
    options?: BaseRequestOptions;
    body?: Body;
  }): Handler {
    let transformJson = this.#config.json;
    if (options?.json !== undefined) {
      transformJson = options.json;
    }

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
    // TODO: recursive merge
    // For now, just shallow merge
    return new Wrq({ ...this.#config, ...config });
  }
}
