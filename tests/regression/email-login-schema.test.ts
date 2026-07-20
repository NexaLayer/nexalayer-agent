import { describe, expect, it } from 'vitest';
import {
  requestEmailLoginCodeSchema,
  verifyEmailLoginCodeSchema,
} from '../../src/modules/account/account.schema';

describe('email login input contract', () => {
  it('accepts a normalized email login request shape', () => {
    expect(
      requestEmailLoginCodeSchema.parse({ email: 'dev@nexalayer.net' })
    ).toEqual({ email: 'dev@nexalayer.net' });
  });

  it('requires exactly six numeric digits', () => {
    expect(
      verifyEmailLoginCodeSchema.parse({
        email: 'dev@nexalayer.net',
        code: '042731',
      }).code
    ).toBe('042731');
    expect(() =>
      verifyEmailLoginCodeSchema.parse({
        email: 'dev@nexalayer.net',
        code: '12345',
      })
    ).toThrow();
    expect(() =>
      verifyEmailLoginCodeSchema.parse({
        email: 'dev@nexalayer.net',
        code: '12A456',
      })
    ).toThrow();
  });
});
