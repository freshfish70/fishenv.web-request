import { ErrorHook, InternalRequestOptions, RequestHooks, ResponseHook, WrqOptions } from './types.ts';
import { logger } from './helpers/mod.ts';
import { HttpError, TimeoutError } from './errors/mod.ts';

type HandlerArgs = WrqOptions & {
  request: {
    options: InternalRequestOptions;
    path: string;
  };
};

export class Handler {
  private readonly TIMEOUT_DEFAULT = 10_000;

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

  async #tryRunResponseHook(response: Response, hookName: ResponseHook) {
    logger.log(`Try run response hook: ${hookName}`);
    const hookResult = this.#config.hooks?.[hookName]?.(response.clone());
    if (hookResult instanceof Promise) {
      await hookResult;
    }
    logger.log('Response hook done');
  }

  async #tryRunErrorHook(error: Error, hookName: ErrorHook) {
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

      const response = await new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new TimeoutError({ options }));
        }, timeout || this.TIMEOUT_DEFAULT);

        fetch(url, options)
          .then(resolve)
          .catch(reject)
          .finally(() => clearTimeout(timer));
      });

      await this.#tryRunResponseHook(response, 'onResponse');
      if (!response.ok) {
        logger.warn(`Request failed with status ${response.status}`);
        await this.#tryRunErrorHook(new HttpError({ options, response }), 'onError');
      } else {
        await this.#tryRunResponseHook(response, 'onSuccess');
      }

      return response;
    } catch (error) {
      if (!(error instanceof Error)) { return; }

      let hookType: ErrorHook = 'onError';
      if (error instanceof TimeoutError) {
        hookType = 'onTimeout';
      } else if ((error as Error)?.name === 'AbortError') {
        hookType = 'onAbort';
      }

      await this.#tryRunErrorHook(error as Error, hookType);

      throw error;
    }
  }

  async json<T>(transform?: (data: unknown) => T): Promise<T> {
    const result = await this.#request(this.#config.request.path, this.#config.request.options);

    if (!result) {
      throw new Error('Request failed');
    }

    const j = await result.json();

    return (transform ? transform(j) : j) as T;
  }

  async raw(): Promise<Response> {
    const result = await this.#request(this.#config.request.path, this.#config.request.options);

    if (!result) {
      throw new Error('Request failed');
    }

    return result;
  }
}
