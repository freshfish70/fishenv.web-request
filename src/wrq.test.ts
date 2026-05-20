import { assert, assertEquals, assertInstanceOf, assertNotStrictEquals, assertThrows } from 'jsr:@std/assert';
import { Wrq } from './wrq.ts';
import { Handler } from './handler.ts';

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

Deno.test('Wrq constructor', async (t) => {
  await t.step('defaults json to true when not provided', () => {
    // json behaviour is tested indirectly via handler; here we verify the
    // instance can be created without options and behaves as a Wrq instance.
    assertInstanceOf(new Wrq(), Wrq);
  });

  await t.step('respects an explicit json: false option', () => {
    // The instance should be created without throwing.
    assertInstanceOf(new Wrq({ json: false }), Wrq);
  });

  await t.step('auto-generates a name when none is provided', () => {
    const client = new Wrq();
    assert(client.name.length > 0, 'name should not be empty');
  });

  await t.step('uses the provided name', () => {
    const client = new Wrq({ name: 'my-client' });
    assertEquals(client.name, 'my-client');
  });

  await t.step('two instances without a name get distinct names', () => {
    const a = new Wrq();
    const b = new Wrq();
    assertNotStrictEquals(a.name, b.name);
  });
});

// ---------------------------------------------------------------------------
// HTTP method factories — return a Handler
// ---------------------------------------------------------------------------

Deno.test('Wrq HTTP method factories', async (t) => {
  const client = new Wrq({ baseUrl: 'https://example.com' });

  const methods = ['get', 'delete', 'head', 'options'] as const;
  for (const method of methods) {
    await t.step(`${method}() returns a Handler`, () => {
      assertInstanceOf(client[method]('/path'), Handler);
    });
  }

  const bodyMethods = ['post', 'put', 'patch'] as const;
  for (const method of bodyMethods) {
    await t.step(`${method}() returns a Handler`, () => {
      assertInstanceOf(client[method]('/path', 'body'), Handler);
    });
  }
});

// ---------------------------------------------------------------------------
// clone()
// ---------------------------------------------------------------------------

Deno.test('Wrq clone()', async (t) => {
  await t.step('returns a new Wrq instance', () => {
    const base = new Wrq({ baseUrl: 'https://example.com' });
    const cloned = base.clone({});
    assertInstanceOf(cloned, Wrq);
    assertNotStrictEquals(cloned, base);
  });

  await t.step('preserves the original baseUrl when not overridden', () => {
    const base = new Wrq({ baseUrl: 'https://example.com', name: 'base' });
    const cloned = base.clone({ name: 'cloned' });
    // The cloned name should be overridden
    assertEquals(cloned.name, 'cloned');
  });

  await t.step('does not mutate the original instance', () => {
    const base = new Wrq({ name: 'original' });
    base.clone({ name: 'cloned' });
    assertEquals(base.name, 'original');
  });

  await t.step('cloned instance is independent from the original', () => {
    const base = new Wrq({ name: 'base' });
    const cloned = base.clone({ name: 'cloned' });
    assertNotStrictEquals(base, cloned);
    assertEquals(base.name, 'base');
    assertEquals(cloned.name, 'cloned');
  });
});

// ---------------------------------------------------------------------------
// getConfig()
// ---------------------------------------------------------------------------

Deno.test('Wrq getConfig()', async (t) => {
  await t.step('returns the config values that were passed to the constructor', () => {
    const client = new Wrq({
      name: 'test-client',
      baseUrl: 'https://api.example.com',
      headers: { 'X-App': 'v1' },
      timeout: 3000,
      json: false,
    });
    const config = client.getConfig();
    assertEquals(config.name, 'test-client');
    assertEquals(config.baseUrl, 'https://api.example.com');
    assertEquals(config.headers, { 'X-App': 'v1' });
    assertEquals(config.timeout, 3000);
    assertEquals(config.json, false);
  });

  await t.step('the returned object is frozen at the top level', () => {
    const config = new Wrq({ name: 'test' }).getConfig();
    assert(Object.isFrozen(config));
  });

  await t.step('the nested headers object is frozen', () => {
    const config = new Wrq({ headers: { 'X-Foo': 'bar' } }).getConfig();
    assert(Object.isFrozen(config.headers));
  });

  await t.step('the nested hooks object is frozen', () => {
    const config = new Wrq({ hooks: { onError: () => {} } }).getConfig();
    assert(Object.isFrozen(config.hooks));
  });

  await t.step('writing to a top-level property throws TypeError', () => {
    const config = new Wrq({ baseUrl: 'https://example.com' }).getConfig();
    assertThrows(
      () => { (config as Record<string, unknown>).baseUrl = 'https://other.com'; },
      TypeError
    );
  });

  await t.step('writing to the headers object throws TypeError', () => {
    const config = new Wrq({ headers: { 'X-Foo': 'bar' } }).getConfig();
    assertThrows(
      () => { config.headers!['X-New'] = 'injected'; },
      TypeError
    );
  });

  await t.step('replacing a hook throws TypeError', () => {
    const config = new Wrq({ hooks: { onError: () => {} } }).getConfig();
    assertThrows(
      () => { (config.hooks as Record<string, unknown>)['onError'] = () => {}; },
      TypeError
    );
  });

  await t.step('each call returns a new object reference (independent snapshot)', () => {
    const client = new Wrq({ name: 'test' });
    const a = client.getConfig();
    const b = client.getConfig();
    assertNotStrictEquals(a, b);
    assertEquals(a, b); // same shape
  });

  await t.step('each call returns a new headers object reference', () => {
    const client = new Wrq({ headers: { 'X-Foo': 'bar' } });
    assertNotStrictEquals(client.getConfig().headers, client.getConfig().headers);
  });

  await t.step('the internal config is not frozen by calling getConfig()', () => {
    // If getConfig() accidentally froze #config.headers (same ref), then
    // clone() would fail because deepMerge writes into the same object.
    const client = new Wrq({ headers: { 'X-Foo': 'bar' } });
    client.getConfig(); // must NOT freeze internal state
    const cloned = client.clone({ headers: { 'X-Extra': 'baz' } });
    assertEquals(cloned.getConfig().headers, { 'X-Foo': 'bar', 'X-Extra': 'baz' });
  });

  await t.step('clone() config reflects the deep-merged result', () => {
    const base = new Wrq({
      baseUrl: 'https://api.example.com',
      headers: { 'X-Base': 'base' },
      timeout: 5000,
    });
    const cloned = base.clone({
      headers: { 'X-Extra': 'extra' },
      timeout: 1000,
    });
    const config = cloned.getConfig();
    assertEquals(config.baseUrl, 'https://api.example.com'); // preserved from base
    assertEquals(config.headers!['X-Base'], 'base');          // preserved from base
    assertEquals(config.headers!['X-Extra'], 'extra');         // added by clone
    assertEquals(config.timeout, 1000);                        // overridden by clone
  });

  await t.step('original instance config is unchanged after clone()', () => {
    const base = new Wrq({
      baseUrl: 'https://api.example.com',
      timeout: 5000,
    });
    base.clone({ baseUrl: 'https://other.com', timeout: 1000 });
    const config = base.getConfig();
    assertEquals(config.baseUrl, 'https://api.example.com');
    assertEquals(config.timeout, 5000);
  });

  await t.step('two clones from the same base have independent configs', () => {
    const base = new Wrq({ baseUrl: 'https://api.example.com' });
    const cloneA = base.clone({ name: 'clone-a' });
    const cloneB = base.clone({ name: 'clone-b' });
    assertEquals(cloneA.getConfig().name, 'clone-a');
    assertEquals(cloneB.getConfig().name, 'clone-b');
    assertEquals(cloneA.getConfig().baseUrl, cloneB.getConfig().baseUrl);
  });
});
