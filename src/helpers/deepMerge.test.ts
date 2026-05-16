import { assertEquals, assertNotStrictEquals, assertStrictEquals } from 'jsr:@std/assert';
import { deepMerge } from './deepMerge.ts';

Deno.test('deepMerge', async (t) => {
  // -------------------------------------------------------------------------
  // Null / undefined source
  // -------------------------------------------------------------------------

  await t.step('returns target unchanged when source is undefined', () => {
    const target = { a: 1 };
    const result = deepMerge(target, undefined);
    assertStrictEquals(result, target);
  });

  await t.step('returns target unchanged when source is null', () => {
    const target = { a: 1 };
    const result = deepMerge(target, null);
    assertStrictEquals(result, target);
  });

  // -------------------------------------------------------------------------
  // Non-plain-object targets
  // -------------------------------------------------------------------------

  await t.step('returns a primitive target as-is', () => {
    assertStrictEquals(deepMerge(42 as never, { a: 1 } as never), 42 as never);
    assertStrictEquals(deepMerge('hello' as never, {} as never), 'hello' as never);
    assertStrictEquals(deepMerge(true as never, {} as never), true as never);
  });

  await t.step('returns a null target as-is', () => {
    assertStrictEquals(deepMerge(null as never, {} as never), null as never);
  });

  // -------------------------------------------------------------------------
  // Flat / top-level property merging
  // -------------------------------------------------------------------------

  await t.step('merges flat properties from source into target', () => {
    const result = deepMerge({ a: 1, b: 2 } as Record<string, unknown>, { b: 99, c: 3 });
    assertEquals(result, { a: 1, b: 99, c: 3 });
  });

  await t.step('preserves target keys that are absent in source', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 99 });
    assertEquals(result, { a: 1, b: 99 });
  });

  await t.step('skips source keys whose value is undefined', () => {
    const result = deepMerge({ a: 1 }, { a: undefined });
    assertEquals(result, { a: 1 });
  });

  await t.step('replaces a target value with null when source value is null', () => {
    const result = deepMerge({ a: 1 } as Record<string, unknown>, { a: null });
    assertEquals(result, { a: null });
  });

  // -------------------------------------------------------------------------
  // Immutability
  // -------------------------------------------------------------------------

  await t.step('does not mutate the target object', () => {
    const target = { a: 1, nested: { x: 10 } };
    deepMerge(target, { a: 2, nested: { x: 99 } });
    assertEquals(target, { a: 1, nested: { x: 10 } });
  });

  await t.step('does not mutate the source object', () => {
    const source = { a: 2, nested: { x: 99 } };
    deepMerge({ a: 1, nested: { x: 10 } }, source);
    assertEquals(source, { a: 2, nested: { x: 99 } });
  });

  await t.step('returns a new object reference (not the original target)', () => {
    const target = { a: 1 } as Record<string, unknown>;
    const result = deepMerge(target, { b: 2 });
    assertNotStrictEquals(result, target);
  });

  // -------------------------------------------------------------------------
  // Nested plain objects (recursive merging)
  // -------------------------------------------------------------------------

  await t.step('recursively merges nested plain objects', () => {
    const result = deepMerge(
      { outer: { a: 1, b: 2 } } as Record<string, Record<string, unknown>>,
      { outer: { b: 99, c: 3 } }
    );
    assertEquals(result, { outer: { a: 1, b: 99, c: 3 } });
  });

  await t.step('recursively merges deeply nested plain objects', () => {
    const result = deepMerge(
      { l1: { l2: { l3: { x: 1, y: 2 } } } } as Record<string, unknown>,
      { l1: { l2: { l3: { y: 99, z: 3 } } } } as Record<string, unknown>
    );
    assertEquals(result, { l1: { l2: { l3: { x: 1, y: 99, z: 3 } } } });
  });

  await t.step('nested result objects are also new references', () => {
    const target = { nested: { a: 1, b: 0 } };
    const result = deepMerge(target as Record<string, Record<string, unknown>>, { nested: { b: 2 } });
    assertNotStrictEquals(result.nested, target.nested);
  });

  await t.step('adds a nested plain-object key that does not exist in target', () => {
    const result = deepMerge({ a: 1 } as Record<string, unknown>, { b: { c: 42 } });
    assertEquals(result, { a: 1, b: { c: 42 } });
  });

  await t.step('replaces target plain object with a primitive from source', () => {
    const result = deepMerge(
      { nested: { a: 1 } } as Record<string, unknown>,
      { nested: 99 }
    );
    assertEquals(result, { nested: 99 });
  });

  await t.step('replaces target primitive with a plain object from source', () => {
    const result = deepMerge(
      { nested: 99 } as Record<string, unknown>,
      { nested: { a: 1 } }
    );
    assertEquals(result, { nested: { a: 1 } });
  });

  // -------------------------------------------------------------------------
  // Arrays — replaced as-is
  // -------------------------------------------------------------------------

  await t.step('replaces a target array wholesale (no element-merging)', () => {
    const result = deepMerge({ arr: [1, 2, 3] }, { arr: [4, 5] });
    assertEquals(result, { arr: [4, 5] });
  });

  await t.step('preserves the exact source array reference', () => {
    const newArr = [4, 5];
    const result = deepMerge({ arr: [1, 2, 3] }, { arr: newArr });
    assertStrictEquals(result.arr, newArr);
  });

  await t.step('adds an array key that does not exist in target', () => {
    const result = deepMerge({ a: 1 } as Record<string, unknown>, { arr: [1, 2] });
    assertEquals(result, { a: 1, arr: [1, 2] });
  });

  await t.step('does not recurse into arrays even if they contain objects', () => {
    const srcArr = [{ x: 1 }, { y: 2 }];
    const result = deepMerge(
      { arr: [{ x: 99 }] } as Record<string, unknown>,
      { arr: srcArr }
    );
    assertStrictEquals((result as Record<string, unknown>).arr, srcArr);
  });

  // -------------------------------------------------------------------------
  // Non-plain-object values (class instances, functions) — replaced as-is
  // -------------------------------------------------------------------------

  await t.step('replaces a class-instance value from source without recursing', () => {
    class Foo {
      val: number;
      constructor(v: number) { this.val = v; }
    }
    const inst = new Foo(99);
    const result = deepMerge(
      { obj: new Foo(1) } as Record<string, unknown>,
      { obj: inst }
    );
    assertStrictEquals((result as Record<string, unknown>).obj, inst);
  });

  await t.step('replaces a function value from source without recursing', () => {
    const fn = () => 42;
    const result = deepMerge(
      { fn: () => 0 } as Record<string, unknown>,
      { fn }
    );
    assertStrictEquals((result as Record<string, unknown>).fn, fn);
  });

  // -------------------------------------------------------------------------
  // Real-world: WrqOptions-style merging (headers and hooks)
  // -------------------------------------------------------------------------

  await t.step('merges headers objects without losing existing headers', () => {
    const result = deepMerge(
      { headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'abc' } } as Record<string, Record<string, string>>,
      { headers: { 'Authorization': 'Bearer token' } }
    );
    assertEquals(result, {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': 'abc',
        'Authorization': 'Bearer token'
      }
    });
  });

  await t.step('hook added in clone is merged with existing hooks', () => {
    const existingOnError = () => {};
    const newBeforeRequest = () => {};
    type Config = { hooks?: { onError?: () => void; beforeRequest?: () => void } };
    const result = deepMerge(
      { hooks: { onError: existingOnError } } as Config,
      { hooks: { beforeRequest: newBeforeRequest } }
    );
    assertStrictEquals(result.hooks?.onError, existingOnError);
    assertStrictEquals(result.hooks?.beforeRequest, newBeforeRequest);
  });

  await t.step('hook replacement in clone overwrites only the specified hook', () => {
    const original = () => {};
    const replacement = () => {};
    const onError = () => {};
    type Config = { hooks: { beforeRequest?: () => void; onError?: () => void } };
    const result = deepMerge(
      { hooks: { beforeRequest: original, onError } } as Config,
      { hooks: { beforeRequest: replacement } }
    );
    assertStrictEquals(result.hooks.beforeRequest, replacement);
    assertStrictEquals(result.hooks.onError, onError);
  });
});
