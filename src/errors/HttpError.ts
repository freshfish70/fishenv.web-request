import { BaseRequestOptions } from '../types.ts';
import { WrqError } from './WrqError.ts';

type HttpErrorArgs = {
  response?: Response;
  options: BaseRequestOptions;
};

export class HttpError extends WrqError {
  public readonly response?: Response;
  public readonly options?: BaseRequestOptions;

  constructor({ response, options }: HttpErrorArgs) {
    super(`[WrqHttpError]: Status: ${response?.status ?? 0}, Reason ${response?.statusText || 'unknown'}`.trim());

    this.name = 'WrqHttpError';
    this.response = response;
    this.options = options;
  }
}
