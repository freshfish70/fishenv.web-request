/**
 * Recursively freezes `obj` and every plain-object value reachable from it.
 *
 * Rules:
 * - `null`, primitives, and functions are returned as-is (nothing to freeze).
 * - Objects that are already frozen are skipped (avoids redundant work).
 * - All other objects — plain objects, arrays, class instances — are recursed
 *   into (own enumerable keys only) and then frozen with `Object.freeze`.
 * - The argument is frozen **in-place**; a reference to the same (now-frozen)
 *   object is returned for convenience so callers can write
 *   `return deepFreeze(copy)`.
 *
 * @param obj - The value to freeze.
 * @returns The same reference, now deeply frozen.
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) {
    return obj as Readonly<T>;
  }

  // Recurse before freezing the container so that nested objects are sealed
  // first (freezing a parent doesn't automatically freeze its children).
  for (const key of Object.keys(obj as object)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object') {
      deepFreeze(val);
    }
  }

  return Object.freeze(obj);
}
