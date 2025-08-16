import type { WrqOptions, WrqRequestMethods } from './types.ts';
import { Wrq } from './wrq.ts';

/**
 * Factory function to create a new instance of Wrq with the provided options.
 * @param {WrqOptions} args - The options to configure the Wrq instance.
 * @return {Wrq} A new instance of Wrq.
 */
function instance(args?: WrqOptions): Wrq {
  return new Wrq(args);
}

const wrq = instance();
instance['post'] = wrq.post.bind(wrq) as WrqRequestMethods['post'];
instance['get'] = wrq.get.bind(wrq) as WrqRequestMethods['get'];
instance['put'] = wrq.put.bind(wrq) as WrqRequestMethods['put'];
instance['patch'] = wrq.patch.bind(wrq) as WrqRequestMethods['patch'];
instance['delete'] = wrq.delete.bind(wrq) as WrqRequestMethods['delete'];
instance['head'] = wrq.head.bind(wrq) as WrqRequestMethods['head'];
instance['options'] = wrq.options.bind(wrq) as WrqRequestMethods['options'];
instance['clone'] = wrq.clone.bind(wrq) as Wrq['clone'];

export default instance;
