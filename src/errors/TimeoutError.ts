import { BaseRequestOptions } from '../types.ts';
import { WrqError } from './WrqError.ts';

type HttpErrorArgs = {
  options: BaseRequestOptions;
};

export class TimeoutError extends WrqError {
  public readonly options?: BaseRequestOptions;

  constructor({ options }: HttpErrorArgs) {
    super(`[WrqTimeoutError]: Request timed out after ${options.timeout ?? 0}ms`.trim());
    this.name = 'WrqTimeoutError';
    this.options = options;
  }
}
