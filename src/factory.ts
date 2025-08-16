import { WrqOptions } from './types.ts';
import { Wrq } from './wrq.ts';

/**
 * Factory function to create a new instance of Wrq with the provided options.
 * @param {WrqOptions} args - The options to configure the Wrq instance.
 * @return {Wrq} A new instance of Wrq.
 */
export default function instance(args?: WrqOptions): Wrq {
  return new Wrq(args);
}
