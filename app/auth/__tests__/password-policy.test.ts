import { PasswordPolicyValidator, DEFAULT_PASSWORD_POLICY } from '@/lib/auth/password-policy';
import { COMMON_PASSWORDS } from '@/lib/auth/common-passwords';

describe('PasswordPolicyValidator', () => {
  it('should reject password shorter than 8 characters', () => {
    const validator = new PasswordPolicyValidator();
    const result = validator.validate('short');

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('at least 8 characters'))).toBe(true);
  });

  it('should reject password without uppercase', () => {
    const validator = new PasswordPolicyValidator();
    const result = validator.validate('lowercase123');

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('uppercase letter'))).toBe(true);
  });

  it('should reject password without lowercase', () => {
    const validator = new PasswordPolicyValidator();
    const result = validator.validate('UPPERCASE123');

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('lowercase letter'))).toBe(true);
  });

  it('should reject password without numbers', () => {
    const validator = new PasswordPolicyValidator();
    const result = validator.validate('NoNumbers!');

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('number'))).toBe(true);
  });

  it('should reject password without special characters', () => {
    const validator = new PasswordPolicyValidator();
    const result = validator.validate('NoSpecialChars123');

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('special character'))).toBe(true);
  });

  it('should reject common passwords', () => {
    const validator = new PasswordPolicyValidator();
    const result = validator.validate('Password123');

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('stronger password'))).toBe(true);
  });

  it('should accept strong password', () => {
    const validator = new PasswordPolicyValidator();
    const result = validator.validate('StrongP@ssw0rd!');

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return requirements list', () => {
    const validator = new PasswordPolicyValidator();
    const requirements = validator.getRequirements();

    expect(requirements).toContain('At least 8 characters');
    expect(requirements).toContain('One uppercase letter');
    expect(requirements).toContain('One lowercase letter');
    expect(requirements).toContain('One number');
    expect(requirements).toContain('One special character');
    expect(requirements).toContain('Not a common password');
  });

  it('should use default policy when none provided', () => {
    const validator = new PasswordPolicyValidator();
    const result = validator.validate('StrongP@ssw0rd!');

    expect(result.valid).toBe(true);
  });

  it('should work with custom policy', () => {
    const customPolicy = {
      minLength: 12,
      requireUppercase: false,
      requireLowercase: false,
      requireNumbers: false,
      requireSpecialChars: false,
      rejectCommonPasswords: false
    };

    const validator = new PasswordPolicyValidator(customPolicy);
    const result = validator.validate('password');

    expect(result.valid).toBe(false); // Still fails length check
    expect(result.errors.some(error => error.includes('at least 12 characters'))).toBe(true);
  });
});
