export class WrqError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WrqError';
  }
}
