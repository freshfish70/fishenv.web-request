/**
 * Response members that touch the body. Accessing any of these on the wrapper
 * triggers the actual clone.
 */
const BODY_ACCESSORS = new Set<PropertyKey>([
  'body',
  'json',
  'text',
  'blob',
  'arrayBuffer',
  'formData',
  'bytes',
  'clone'
]);

/**
 * Wraps a response so its body is only cloned when it is actually read.
 *
 * Cloning tees the body stream, and an unread branch buffers everything the
 * stream sends and keeps the connection open until both branches are cancelled.
 * For streaming responses (SSE, NDJSON, large downloads) that means unbounded
 * memory growth and a `cancel()` that never resolves.
 *
 * With this wrapper, hooks that only inspect status or headers cost nothing.
 * Hooks that read the body get a real clone, created on first access. The body
 * must be read while the hook runs; once the caller has consumed the original,
 * cloning fails.
 *
 * The wrapper passes `instanceof Response`, but it is a proxy: platform APIs that
 * need a real `Response` (e.g. `cache.put`) reject it. Hooks that need one can
 * call `response.clone()`.
 *
 * @param response - The original response.
 * @returns A response-like proxy that clones the body lazily.
 */
export function lazyClone(response: Response): Response {
  let clone: Response | undefined;

  return new Proxy(response, {
    get(target, prop) {
      // Asking whether the body was read must not tee it: before a clone exists, the hook has read nothing
      if (prop === 'bodyUsed') {
        return clone?.bodyUsed ?? false;
      }
      let source = target;
      if (BODY_ACCESSORS.has(prop)) {
        clone ??= target.clone();
        source = clone;
      }
      const value = Reflect.get(source, prop, source);
      return typeof value === 'function' ? value.bind(source) : value;
    }
  });
}
