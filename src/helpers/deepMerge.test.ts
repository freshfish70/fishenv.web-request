import { describe, expect, test } from 'bun:test';
import { deepMerge } from './deepMerge.ts';

describe('deepMerge', () => {
  // -------------------------------------------------------------------------
  // Null / undefined source
  // -------------------------------------------------------------------------

  test('returns target unchanged when source is undefined', () => {
    const target = { a: 1 };
    const result = deepMerge(target, undefined);
    expect(result).toBe(target);
  });

  test('returns target unchanged when source is null', () => {
    const target = { a: 1 };
    const result = deepMerge(target, null);
    expect(result).toBe(target);
  });

  // -------------------------------------------------------------------------
  // Non-plain-object targets
  // -------------------------------------------------------------------------

  test('returns a primitive target as-is', () => {
    expect(deepMerge(42 as never, { a: 1 } as never)).toBe(42 as never);
    expect(deepMerge('hello' as never, {} as never)).toBe('hello' as never);
    expect(deepMerge(true as never, {} as never)).toBe(true as never);
  });

  test('returns a null target as-is', () => {
    expect(deepMerge(null as never, {} as never)).toBe(null as never);
  });

  // -------------------------------------------------------------------------
  // Flat / top-level property merging
  // -------------------------------------------------------------------------

  test('merges flat properties from source into target', () => {
    const result = deepMerge({ a: 1, b: 2 } as Record<string, unknown>, { b: 99, c: 3 });
    expect(result).toEqual({ a: 1, b: 99, c: 3 });
  });

  test('preserves target keys that are absent in source', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 99 });
    expect(result).toEqual({ a: 1, b: 99 });
  });

  test('skips source keys whose value is undefined', () => {
    const result = deepMerge({ a: 1 }, { a: undefined });
    expect(result).toEqual({ a: 1 });
  });

  test('replaces a target value with null when source value is null', () => {
    const result = deepMerge({ a: 1 } as Record<string, unknown>, { a: null });
    expect(result).toEqual({ a: null });
  });

  // -------------------------------------------------------------------------
  // Immutability
  // -------------------------------------------------------------------------

  test('does not mutate the target object', () => {
    const target = { a: 1, nested: { x: 10 } };
    deepMerge(target, { a: 2, nested: { x: 99 } });
    expect(target).toEqual({ a: 1, nested: { x: 10 } });
  });

  test('does not mutate the source object', () => {
    const source = { a: 2, nested: { x: 99 } };
    deepMerge({ a: 1, nested: { x: 10 } }, source);
    expect(source).toEqual({ a: 2, nested: { x: 99 } });
  });

  test('returns a new object reference (not the original target)', () => {
    const target = { a: 1 } as Record<string, unknown>;
    const result = deepMerge(target, { b: 2 });
    expect(result).not.toBe(target);
  });

  // -------------------------------------------------------------------------
  // Nested plain objects (recursive merging)
  // -------------------------------------------------------------------------

  test('recursively merges nested plain objects', () => {
    const result = deepMerge({ outer: { a: 1, b: 2 } } as Record<string, Record<string, unknown>>, {
      outer: { b: 99, c: 3 }
    });
    expect(result).toEqual({ outer: { a: 1, b: 99, c: 3 } });
  });

  test('recursively merges deeply nested plain objects', () => {
    const result = deepMerge(
      { l1: { l2: { l3: { x: 1, y: 2 } } } } as Record<string, unknown>,
      { l1: { l2: { l3: { y: 99, z: 3 } } } } as Record<string, unknown>
    );
    expect(result).toEqual({ l1: { l2: { l3: { x: 1, y: 99, z: 3 } } } });
  });

  test('nested result objects are also new references', () => {
    const target = { nested: { a: 1, b: 0 } };
    const result = deepMerge(target as Record<string, Record<string, unknown>>, { nested: { b: 2 } });
    expect(result.nested).not.toBe(target.nested);
  });

  test('adds a nested plain-object key that does not exist in target', () => {
    const result = deepMerge({ a: 1 } as Record<string, unknown>, { b: { c: 42 } });
    expect(result).toEqual({ a: 1, b: { c: 42 } });
  });

  test('replaces target plain object with a primitive from source', () => {
    const result = deepMerge({ nested: { a: 1 } } as Record<string, unknown>, { nested: 99 });
    expect(result).toEqual({ nested: 99 });
  });

  test('replaces target primitive with a plain object from source', () => {
    const result = deepMerge({ nested: 99 } as Record<string, unknown>, { nested: { a: 1 } });
    expect(result).toEqual({ nested: { a: 1 } });
  });

  // -------------------------------------------------------------------------
  // Arrays — replaced as-is
  // -------------------------------------------------------------------------

  test('replaces a target array wholesale (no element-merging)', () => {
    const result = deepMerge({ arr: [1, 2, 3] }, { arr: [4, 5] });
    expect(result).toEqual({ arr: [4, 5] });
  });

  test('preserves the exact source array reference', () => {
    const newArr = [4, 5];
    const result = deepMerge({ arr: [1, 2, 3] }, { arr: newArr });
    expect(result.arr).toBe(newArr);
  });

  test('adds an array key that does not exist in target', () => {
    const result = deepMerge({ a: 1 } as Record<string, unknown>, { arr: [1, 2] });
    expect(result).toEqual({ a: 1, arr: [1, 2] });
  });

  test('does not recurse into arrays even if they contain objects', () => {
    const srcArr = [{ x: 1 }, { y: 2 }];
    const result = deepMerge({ arr: [{ x: 99 }] } as Record<string, unknown>, { arr: srcArr });
    expect((result as Record<string, unknown>).arr).toBe(srcArr);
  });

  // -------------------------------------------------------------------------
  // Non-plain-object values (class instances, functions) — replaced as-is
  // -------------------------------------------------------------------------

  test('replaces a class-instance value from source without recursing', () => {
    class Foo {
      val: number;
      constructor(v: number) {
        this.val = v;
      }
    }
    const inst = new Foo(99);
    const result = deepMerge({ obj: new Foo(1) } as Record<string, unknown>, { obj: inst });
    expect((result as Record<string, unknown>).obj).toBe(inst);
  });

  test('replaces a function value from source without recursing', () => {
    const fn = () => 42;
    const result = deepMerge({ fn: () => 0 } as Record<string, unknown>, { fn });
    expect((result as Record<string, unknown>).fn).toBe(fn);
  });

  // -------------------------------------------------------------------------
  // Real-world: WrqOptions-style merging (headers and hooks)
  // -------------------------------------------------------------------------

  test('merges headers objects without losing existing headers', () => {
    const result = deepMerge(
      { headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'abc' } } as Record<
        string,
        Record<string, string>
      >,
      { headers: { 'Authorization': 'Bearer token' } }
    );
    expect(result).toEqual({
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'abc', 'Authorization': 'Bearer token' }
    });
  });

  test('hook added in clone is merged with existing hooks', () => {
    const existingOnError = () => {};
    const newBeforeRequest = () => {};
    type Config = { hooks?: { onError?: () => void; beforeRequest?: () => void } };
    const result = deepMerge({ hooks: { onError: existingOnError } } as Config, {
      hooks: { beforeRequest: newBeforeRequest }
    });
    expect(result.hooks?.onError).toBe(existingOnError);
    expect(result.hooks?.beforeRequest).toBe(newBeforeRequest);
  });

  test('hook replacement in clone overwrites only the specified hook', () => {
    const original = () => {};
    const replacement = () => {};
    const onError = () => {};
    type Config = { hooks: { beforeRequest?: () => void; onError?: () => void } };
    const result = deepMerge({ hooks: { beforeRequest: original, onError } } as Config, {
      hooks: { beforeRequest: replacement }
    });
    expect(result.hooks.beforeRequest).toBe(replacement);
    expect(result.hooks.onError).toBe(onError);
  });
});
