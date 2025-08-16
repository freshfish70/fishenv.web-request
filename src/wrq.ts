import type { BaseRequestOptions, Body, RequestMethod, WrqInstance, WrqOptions } from './types.ts';
import { Handler } from './handler.ts';

export class Wrq implements WrqInstance {
  #config: WrqOptions = {};

  constructor(config: WrqOptions = {}) {
    this.#config = config;
  }

  get name() {
    return this.#config.name || 'wrq';
  }

  #transformBody(body: Body) {
    if (!body) {
      return null;
    }

    if (typeof body === 'object') {
      return JSON.stringify(body);
    }
  }

  #toHandler({ path, method, options, body }: {
    path: string;
    method: RequestMethod;
    options?: BaseRequestOptions;
    body?: Body;
  }): Handler {
    return new Handler({
      ...this.#config,
      request: {
        path,
        options: {
          ...options,
          method,
          body: this.#transformBody(body)
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
