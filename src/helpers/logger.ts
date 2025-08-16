export const logger = {
  log: (...args: unknown[]) => console.log('%c[Wrq:handler]:', 'color: #4CAF50; font-weight: bold;', ...args),
  warn: (...args: unknown[]) => console.warn('%c[Wrq:handler]:', 'color: #cccc44; font-weight: bold;', ...args),
  error: (...args: unknown[]) => console.error('%c[Wrq:handler]:', 'color: #cc5555; font-weight: bold;', ...args)
};
