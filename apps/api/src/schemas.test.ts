import { describe, it, expect } from 'vitest';
import { registerSchema } from '@maintenance-log/domain';

const validBase = {
  fullName: 'Test User',
  email: 'test@example.com',
  password: 'SecurePass1',
  confirmPassword: 'SecurePass1',
};

describe('registerSchema — email', () => {
  it('trims leading and trailing whitespace', () => {
    const result = registerSchema.parse({ ...validBase, email: '  test@example.com  ' });
    expect(result.email).toBe('test@example.com');
  });

  it('normalizes to lowercase', () => {
    const result = registerSchema.parse({ ...validBase, email: 'Test@Example.COM' });
    expect(result.email).toBe('test@example.com');
  });

  it('trims and lowercases together', () => {
    const result = registerSchema.parse({ ...validBase, email: '  TEST@EXAMPLE.COM  ' });
    expect(result.email).toBe('test@example.com');
  });

  it('rejects an invalid email format', () => {
    const result = registerSchema.safeParse({ ...validBase, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema — fullName', () => {
  it('trims leading and trailing whitespace', () => {
    const result = registerSchema.parse({ ...validBase, fullName: '  John Smith  ' });
    expect(result.fullName).toBe('John Smith');
  });

  it('rejects an empty string after trimming', () => {
    const result = registerSchema.safeParse({ ...validBase, fullName: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects names longer than 100 characters', () => {
    const result = registerSchema.safeParse({ ...validBase, fullName: 'A'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema — password', () => {
  it('rejects passwords shorter than 8 characters', () => {
    const short = { password: 'Ab1', confirmPassword: 'Ab1' };
    expect(registerSchema.safeParse({ ...validBase, ...short }).success).toBe(false);
  });

  it('rejects passwords with no letter', () => {
    const noLetter = { password: '12345678', confirmPassword: '12345678' };
    expect(registerSchema.safeParse({ ...validBase, ...noLetter }).success).toBe(false);
  });

  it('rejects passwords with no digit', () => {
    const noDigit = { password: 'NoDigitsHere', confirmPassword: 'NoDigitsHere' };
    expect(registerSchema.safeParse({ ...validBase, ...noDigit }).success).toBe(false);
  });

  it('rejects passwords longer than 128 characters', () => {
    const long = 'Aa1' + 'x'.repeat(126); // 129 chars
    expect(registerSchema.safeParse({ ...validBase, password: long, confirmPassword: long }).success).toBe(false);
  });

  it('accepts passwords of exactly 128 characters', () => {
    const max = 'Aa1' + 'x'.repeat(125); // 128 chars
    expect(registerSchema.safeParse({ ...validBase, password: max, confirmPassword: max }).success).toBe(true);
  });

  it('rejects when passwords do not match', () => {
    const result = registerSchema.safeParse({ ...validBase, confirmPassword: 'DifferentPass1' });
    expect(result.success).toBe(false);
  });
});
