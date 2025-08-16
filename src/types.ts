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

  /**
   * If true all body data will be transformed to JSON.
   * This is useful for APIs that expect JSON data.
   * If false, the body will be sent as is.
   * Defaults to true.
   */
  json?: boolean;
};

/**
 * The result of a request hook.
 * It can be either void or a Promise that resolves to void.
 * This allows hooks to perform asynchronous operations if needed.
 */
type RequestHookResult = void | Promise<void>;

export type ResponseHook = keyof Pick<RequestHooks, 'onResponse' | 'onSuccess'>;
export type ErrorHook = keyof Pick<RequestHooks, 'onError' | 'onTimeout' | 'onAbort'>;
export type BeforeRequestHook = keyof Pick<RequestHooks, 'beforeRequest'>;

export type RequestHooks = {
  /**
   * Hook to run before the request is sent.
   * Can modify the request options or return a new set of options, or partially modify them.
   * The returned options will be deeply merged with the original request options so only modified properties need to be returned.
   */
  beforeRequest?: (options: BaseRequestOptions) => BaseRequestOptions | Promise<BaseRequestOptions> | void;
  /**
   * Hook to run when a response is received.
   * This is run before the response is processed.
   * Can be used to log the response, modify it, or perform other actions.
   * The response is a clone of the original response to avoid side effects.
   */
  onResponse?: (response: Response) => RequestHookResult;
  /**
   * Hook runs on a error during the request.
   */
  onError?: (error: Error) => RequestHookResult;
  /**
   * Hook runs when the request times out.
   * This is run when the request exceeds the specified timeout.
   */
  onTimeout?: (error: Error) => RequestHookResult;
  /**
   * Hook runs when the request is aborted.
   * This is run when the request is aborted by the user or by the system.
   */
  onAbort?: (error: Error) => RequestHookResult;
  /**
   * Hook runs when the request is successful.
   * This is run before the response is processed and before the result is returned.
   * The response is a clone of the original response to avoid side effects.
   */
  onSuccess?: (response: Response) => RequestHookResult;
};

export type RequestResult<T = unknown> = Omit<Response, 'json'> & {
  json: () => Promise<T>;
};

export type RequestResponse<T = unknown> = Promise<RequestResult<T>>;

/**
 * The type of HTTP request methods supported by the library.
 */
export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type BaseRequestOptions = Omit<RequestInit, 'method' | 'body' | 'signal'> & {
  json?: boolean;
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

/**
 * The main interface for the Wrq library.
 * It provides methods for making HTTP requests and handling responses.
 * It can be cloned to create a new instance with different configuration options.
 */
export type WrqInstance = {
  clone: (options: WrqOptions) => WrqInstance;
} & WrqRequestMethods;

/**
 * The type of the body that can be sent in a request.
 * It can be an object, undefined, or null.
 * This allows for flexibility in the request body, accommodating various use cases.
 * The body is transformed to JSON
 */
export type Body = string | object | undefined | null;
