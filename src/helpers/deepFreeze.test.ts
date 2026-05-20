import { assert, assertEquals, assertStrictEquals, assertThrows } from 'jsr:@std/assert';
import { deepFreeze } from './deepFreeze.ts';

Deno.test('deepFreeze', async (t) => {
  // ---------------------------------------------------------------------------
  // Passthrough cases — nothing to freeze
  // ---------------------------------------------------------------------------

  await t.step('returns null as-is', () => {
    assertStrictEquals(deepFreeze(null), null);
  });

  await t.step('returns a number as-is', () => {
    assertStrictEquals(deepFreeze(42 as never), 42 as never);
  });

  await t.step('returns a string as-is', () => {
    assertStrictEquals(deepFreeze('hello' as never), 'hello' as never);
  });

  await t.step('returns a boolean as-is', () => {
    assertStrictEquals(deepFreeze(true as never), true as never);
  });

  await t.step('returns a function as-is without freezing it', () => {
    const fn = () => 42;
    assertStrictEquals(deepFreeze(fn as never), fn as never);
    assert(!Object.isFrozen(fn), 'functions should not be frozen');
  });

  // ---------------------------------------------------------------------------
  // Return value
  // ---------------------------------------------------------------------------

  await t.step('returns the same object reference (freezes in-place)', () => {
    const obj = { a: 1 };
    const result = deepFreeze(obj);
    assertStrictEquals(result, obj);
  });

  await t.step('returns an already-frozen object unchanged', () => {
    const obj = Object.freeze({ a: 1 });
    const result = deepFreeze(obj);
    assertStrictEquals(result, obj);
  });

  // ---------------------------------------------------------------------------
  // Top-level freezing
  // ---------------------------------------------------------------------------

  await t.step('freezes a flat object', () => {
    const obj = { a: 1, b: 'two' };
    deepFreeze(obj);
    assert(Object.isFrozen(obj));
  });

  await t.step('writing to a frozen top-level property throws TypeError', () => {
    const obj = deepFreeze({ a: 1 });
    assertThrows(
      () => { (obj as Record<string, unknown>).a = 99; },
      TypeError
    );
  });

  await t.step('adding a new top-level property throws TypeError', () => {
    const obj = deepFreeze({} as Record<string, unknown>);
    assertThrows(
      () => { obj.newKey = 'value'; },
      TypeError
    );
  });

  await t.step('deleting a top-level property throws TypeError', () => {
    const obj = deepFreeze({ a: 1 } as Record<string, unknown>);
    assertThrows(
      () => { delete obj.a; },
      TypeError
    );
  });

  // ---------------------------------------------------------------------------
  // Deep / nested freezing
  // ---------------------------------------------------------------------------

  await t.step('freezes a nested plain object', () => {
    const obj = deepFreeze({ outer: { inner: 1 } });
    assert(Object.isFrozen(obj.outer));
  });

  await t.step('writing to a nested property throws TypeError', () => {
    const obj = deepFreeze({ outer: { inner: 1 } });
    assertThrows(
      () => { (obj.outer as Record<string, unknown>).inner = 99; },
      TypeError
    );
  });

  await t.step('freezes objects nested three levels deep', () => {
    const obj = deepFreeze({ l1: { l2: { l3: { x: 0 } } } });
    assert(Object.isFrozen(obj.l1.l2.l3));
  });

  await t.step('freezes an array', () => {
    const obj = deepFreeze({ arr: [1, 2, 3] });
    assert(Object.isFrozen(obj.arr));
  });

  await t.step('freezes objects that are elements of a nested array', () => {
    const obj = deepFreeze({ arr: [{ x: 1 }, { x: 2 }] });
    assert(Object.isFrozen(obj.arr[0]));
    assert(Object.isFrozen(obj.arr[1]));
  });

  // ---------------------------------------------------------------------------
  // Function values inside objects — not frozen, but their containing object is
  // ---------------------------------------------------------------------------

  await t.step('freezes the object that contains a function value', () => {
    const fn = () => {};
    const obj = deepFreeze({ fn });
    assert(Object.isFrozen(obj));
  });

  await t.step('does not freeze the function value itself', () => {
    const fn = () => {};
    deepFreeze({ fn });
    assert(!Object.isFrozen(fn));
  });

  await t.step('replacing a function property on a frozen object throws TypeError', () => {
    const obj = deepFreeze({ fn: () => 1 });
    assertThrows(
      () => { (obj as Record<string, unknown>).fn = () => 2; },
      TypeError
    );
  });

  // ---------------------------------------------------------------------------
  // WrqOptions-shaped object — representative real-world usage
  // ---------------------------------------------------------------------------

  await t.step('correctly freezes a WrqOptions-shaped object', () => {
    const config = deepFreeze({
      name: 'test',
      baseUrl: 'https://example.com',
      headers: { 'Authorization': 'Bearer token', 'X-Custom': 'value' },
      timeout: 5000,
      json: true,
      hooks: {
        beforeRequest: () => {},
        onError: () => {},
      },
    });

    assert(Object.isFrozen(config), 'top-level config should be frozen');
    assert(Object.isFrozen(config.headers), 'headers should be frozen');
    assert(Object.isFrozen(config.hooks), 'hooks should be frozen');
  });

  await t.step('writing to a frozen headers object throws TypeError', () => {
    const config = deepFreeze({
      headers: { 'X-Foo': 'bar' } as Record<string, string>
    });
    assertThrows(
      () => { config.headers!['X-New'] = 'value'; },
      TypeError
    );
  });

  await t.step('replacing a hook on a frozen hooks object throws TypeError', () => {
    const config = deepFreeze({
      hooks: { onError: () => {} } as Record<string, unknown>
    });
    assertThrows(
      () => { config.hooks!['onError'] = () => {}; },
      TypeError
    );
  });
});
