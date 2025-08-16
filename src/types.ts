import { Handler } from './handler.ts';

export type WrqOptions = {
  /**
   * The name of the request instance.
   * Used for logging and debugging purposes.
   */
  name?: string;
  /**
   * The base URL for the requests.
   * If not provided, the requests will be made to the current origin.
   */
  baseUrl?: string;
  /**
   * Default request headers.
   * These headers will be added to every request unless overridden per request.
   */
  headers?: Record<string, string>;
  /**
   * Default request timeout.
   * This is the maximum time to wait for a response before aborting the request.
   * This can be overridden per request.
   * Defaults to 10_000ms (10 seconds).
   */
  timeout?: number;
  /**
   * Hooks to run at various stages of the request lifecycle.
   */
  hooks?: RequestHooks;
};

type RequestHookResult = void | Promise<void>;

export type ResponseHook = keyof Pick<RequestHooks, 'onResponse' | 'onSuccess'>;
export type ErrorHook = keyof Pick<RequestHooks, 'onError' | 'onTimeout' | 'onAbort'>;
export type BeforeRequestHook = keyof Pick<RequestHooks, 'beforeRequest'>;

export type RequestHooks = {
  beforeRequest?: (options: BaseRequestOptions) => BaseRequestOptions | Promise<BaseRequestOptions> | void;
  onResponse?: (response: Response) => RequestHookResult;
  //
  onError?: (error: Error) => RequestHookResult;
  onTimeout?: (error: Error) => RequestHookResult;
  onAbort?: (error: Error) => RequestHookResult;
  //
  onSuccess?: (response: Response) => RequestHookResult;
};

export type RequestResult<T = unknown> = Omit<Response, 'json'> & {
  json: () => Promise<T>;
};

export type RequestResponse<T = unknown> = Promise<RequestResult<T>>;

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type BaseRequestOptions = Omit<RequestInit, 'method' | 'body' | 'signal'> & {
  timeout?: number;
  controller?: AbortController;
};

export type InternalRequestOptions = RequestInit & BaseRequestOptions & {
  method: RequestMethod;
};

export type WrqRequestMethods = {
  get: (path: string, data?: BaseRequestOptions) => Handler;
  delete: (path: string, data?: BaseRequestOptions) => Handler;
  head: (path: string, data?: BaseRequestOptions) => Handler;
  options: (path: string, data?: BaseRequestOptions) => Handler;

  post: (path: string, data?: Body, options?: BaseRequestOptions) => Handler;
  patch: (path: string, data?: Body, options?: BaseRequestOptions) => Handler;
  put: (path: string, data?: Body, options?: BaseRequestOptions) => Handler;
};

export type WrqInstance = {
  clone: (options: WrqOptions) => WrqInstance;
} & WrqRequestMethods;

export type Body = object | undefined | null;
