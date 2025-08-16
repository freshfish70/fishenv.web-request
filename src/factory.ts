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

const wrq = instance();
instance['post'] = wrq.post.bind(wrq);
instance['get'] = wrq.get.bind(wrq);
instance['put'] = wrq.put.bind(wrq);
instance['patch'] = wrq.patch.bind(wrq);
instance['delete'] = wrq.delete.bind(wrq);
instance['head'] = wrq.head.bind(wrq);
instance['options'] = wrq.options.bind(wrq);
instance['clone'] = wrq.clone.bind(wrq);
