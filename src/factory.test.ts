import { describe, expect, test } from 'bun:test';
import { Wrq } from './wrq.ts';

const { default: instance } = await import('./factory.ts');

describe('Factory Test', () => {
  test('Create instance with default options', () => {
    const client = instance();
    expect(client).toBeInstanceOf(Wrq);
  });
});
