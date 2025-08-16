import { InternalRequestOptions, RequestHooks, WrqOptions } from './types.ts';
import logger from './logger.ts';

type HandlerArgs = WrqOptions & {
  request: {
    options: InternalRequestOptions;
    path: string;
  };
};

export class Handler {
  #config: HandlerArgs;

  constructor(config: HandlerArgs) {
    this.#config = config;
  }

  #requestUrl(path: string): URL {
    return new URL(`${this.#config.baseUrl || ''}${path}`);
  }

  async #tryRunBeforeRequestHook(options: InternalRequestOptions) {
    logger.log('Try run before request hook');
    const hookResult = this.#config.hooks?.beforeRequest?.(options);
    const newOptions = hookResult instanceof Promise ? await hookResult : hookResult;
    logger.log('Before request hook done');
    // TODO: Deep merge
    return {
      ...options,
      ...newOptions
    };
  }

  async #tryRunResponseHook(response: Response, hookName: keyof Pick<RequestHooks, 'onResponse' | 'onSuccess'>) {
    logger.log(`Try run response hook: ${hookName}`);
    const hookResult = this.#config.hooks?.[hookName]?.(response.clone());
    if (hookResult instanceof Promise) {
      await hookResult;
    }
    logger.log('Response hook done');
  }

  async #tryRunErrorHook(error: Error, hookName: keyof Pick<RequestHooks, 'onAbort' | 'onError' | 'onTimeout'>) {
    logger.log(`Try run error hook: ${hookName}`);
    const hook = this.#config.hooks?.[hookName]?.(error);

    if (hook instanceof Promise) {
      await hook;
    }

    logger.log(`Error hook done`);
  }

  async #request(path: string, options: InternalRequestOptions) {
    try {
      logger.log('Starting request', path, options);
      const url = this.#requestUrl(path);

      const { timeout, controller } = options;

      options.signal = controller ? controller.signal : new AbortController().signal;
      options = await this.#tryRunBeforeRequestHook(options);

      const result = await new Promise<Response>((resolve, reject) => {
        let timer = undefined;
        if (timeout) {
          timer = setTimeout(() => {
            logger.warn(`Request timed out after ${timeout}ms`);
            reject(new Error(`Request timed out after ${timeout}ms`));
            this.#tryRunErrorHook(new Error(`Request timed out after ${timeout}ms`), 'onTimeout');
          }, timeout);
        }

        fetch(url, options)
          .then(resolve)
          .catch(reject)
          .finally(() => clearTimeout(timer));
      });

      console.log('Got result', result);

      await this.#tryRunResponseHook(result, 'onResponse');
      if (!result.ok) {
        logger.warn(`Request failed with status ${result.status}`);
        await this.#tryRunErrorHook(new Error(`Request failed with status ${result.status}`), 'onError');
      } else {
        await this.#tryRunResponseHook(result, 'onSuccess');
      }

      return result;
    } catch (error) {
      const type = options.signal?.aborted ? 'onAbort' : 'onError';
      await this.#tryRunErrorHook(error as Error, type);
      throw error;
    }
  }

  async json<T>(transform?: (inp: unknown) => T): Promise<T> {
    const result = await this.#request(this.#config.request.path, this.#config.request.options);

    if (!result) {
      throw new Error('Request failed');
    }

    const j = await result.json();

    if (transform) {
      return transform(j);
    }
    return j as T;
  }

  async raw(): Promise<Response> {
    const result = await this.#request(this.#config.request.path, this.#config.request.options);

    if (!result) {
      throw new Error('Request failed');
    }

    return result;
  }
}
