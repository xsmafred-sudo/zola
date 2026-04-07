import { COMMON_PASSWORDS } from './common-passwords';
import { SECURITY_CONFIG } from '@/lib/config';

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  rejectCommonPasswords: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class PasswordPolicyValidator {
  private policy: PasswordPolicy;

  constructor(policy: PasswordPolicy = SECURITY_CONFIG.password) {
    this.policy = policy;
  }

  validate(password: string): ValidationResult {
    const errors: string[] = [];

    // Check minimum length
    if (password.length < this.policy.minLength) {
      errors.push(`Password must be at least ${this.policy.minLength} characters long`);
    }

    // Check uppercase requirement
    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check lowercase requirement
    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check number requirement
    if (this.policy.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check special character requirement
    if (this.policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check common password blacklist
    if (this.policy.rejectCommonPasswords) {
      const lowerPassword = password.toLowerCase();
      if (COMMON_PASSWORDS.includes(lowerPassword)) {
        errors.push('Please choose a stronger password');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  getRequirements(): string[] {
    const requirements: string[] = [];

    requirements.push(`At least ${this.policy.minLength} characters`);
    if (this.policy.requireUppercase) {
      requirements.push('One uppercase letter');
    }
    if (this.policy.requireLowercase) {
      requirements.push('One lowercase letter');
    }
    if (this.policy.requireNumbers) {
      requirements.push('One number');
    }
    if (this.policy.requireSpecialChars) {
      requirements.push('One special character');
    }
    if (this.policy.rejectCommonPasswords) {
      requirements.push('Not a common password');
    }

    return requirements;
  }
}

// Export default password policy for reference
export const DEFAULT_PASSWORD_POLICY = SECURITY_CONFIG.password;
