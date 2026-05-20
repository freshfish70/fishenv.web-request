import { assert, assertInstanceOf } from 'jsr:@std/assert';
import { Wrq } from './wrq.ts';
import { Handler } from './handler.ts';
const { default: instance } = await import('./factory.ts');

Deno.test('Factory', async (t) => {
  await t.step('calling instance() returns a Wrq object', () => {
    assertInstanceOf(instance(), Wrq);
  });

  await t.step('calling instance() with options returns a Wrq object', () => {
    assertInstanceOf(instance({ baseUrl: 'https://example.com' }), Wrq);
  });

  // The factory exposes static-style request methods on the function itself
  // so consumers can use `wrq.get(...)` without calling `wrq(...)` first.

  const bodylessMethods = ['get', 'delete', 'head', 'options'] as const;
  for (const method of bodylessMethods) {
    await t.step(`instance.${method}() returns a Handler`, () => {
      assertInstanceOf(instance[method]('https://example.com/'), Handler);
    });
  }

  const bodyMethods = ['post', 'put', 'patch'] as const;
  for (const method of bodyMethods) {
    await t.step(`instance.${method}() returns a Handler`, () => {
      assertInstanceOf(instance[method]('https://example.com/', 'body'), Handler);
    });
  }

  await t.step('instance.clone() returns a new Wrq object', () => {
    const cloned = instance.clone({ baseUrl: 'https://api.example.com' });
    assertInstanceOf(cloned, Wrq);
  });

  await t.step('instance.getConfig() returns a frozen config object', () => {
    const config = instance.getConfig();
    assert(Object.isFrozen(config), 'config should be frozen');
  });
});
