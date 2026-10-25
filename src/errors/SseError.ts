import { WrqError } from './WrqError.ts';

/**
 * An event stream that cannot be read: the response is not `text/event-stream`, or an event exceeds the size limit.
 */
export class SseError extends WrqError {
  constructor(message: string) {
    super(`[WrqSseError]: ${message}`);
    this.name = 'WrqSseError';
  }
}
