import { assertInstanceOf } from 'jsr:@std/assert';
import { Wrq } from './wrq.ts';
const { default: instance } = await import('./factory.ts');

Deno.test('Factory Test', async (t) => {
  await t.step('Create instance with default options', () => {
    const client = instance();
    assertInstanceOf(client, Wrq);
  });
});
