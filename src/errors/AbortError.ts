import { BaseRequestOptions } from '../types.ts';
import { WrqError } from './WrqError.ts';

type HttpErrorArgs = {
  options: BaseRequestOptions;
};

export class AbortError extends WrqError {
  public readonly options?: BaseRequestOptions;

  constructor(reason: string, { options }: HttpErrorArgs) {
    super(`[WrqAbortError]: ${reason ?? 'unknown'}`.trim());
    this.name = 'WrqAbortError';
    this.options = options;
  }
}
