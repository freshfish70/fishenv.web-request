import { Handler } from './handler.ts';

export type WrqOptions = {
  name?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
  hooks?: RequestHooks;
};

type RequestHookResult = void | Promise<void>;

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
