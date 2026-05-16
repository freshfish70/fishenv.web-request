/**
 * Returns true only for plain objects — i.e. objects whose direct prototype is
 * `Object.prototype` or `null` (e.g. created via `{}` or `Object.create(null)`).
 *
 * This deliberately excludes arrays, class instances, `null`, and primitives so
 * that only data-bag objects are recursed into during a deep merge. Everything
 * else is replaced wholesale.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deeply merges `source` into `target` and returns a **new** object.
 *
 * Rules:
 * - Plain objects are merged **recursively**.
 * - Arrays are **replaced** in their entirety (not concatenated or element-merged).
 * - All other values (primitives, class instances, functions, …) are **replaced**.
 * - A `source` key whose value is `undefined` is **skipped** — the target value
 *   is preserved. This lets callers pass a partial override without accidentally
 *   clearing fields they did not touch.
 * - If `source` itself is `null` or `undefined`, `target` is returned unchanged.
 * - Neither `target` nor `source` is mutated.
 *
 * @param target - The base object to merge into.
 * @param source - A partial object whose values take precedence.
 * @returns A new object that is the deep-merged result.
 */
export function deepMerge<T>(target: T, source: Partial<T> | null | undefined): T {
  if (!isPlainObject(target) || source == null) return target;

  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  const src = source as Record<string, unknown>;

  for (const key of Object.keys(src)) {
    const sourceVal = src[key];
    if (sourceVal === undefined) continue;

    const targetVal = result[key];

    result[key] = isPlainObject(sourceVal) && isPlainObject(targetVal)
      ? deepMerge(targetVal, sourceVal)
      : sourceVal;
  }

  return result as T;
}
