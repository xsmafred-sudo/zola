import { validateEmail, validateDisplayName, validateRedirectUrl } from '@/lib/auth/input-validator';

describe('InputValidator', () => {
  describe('validateEmail', () => {
    it('should accept valid email format', () => {
      const result = validateEmail('user@example.com');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid email format', () => {
      const result = validateEmail('invalid-email');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject email without domain', () => {
      const result = validateEmail('user@');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject email with spaces', () => {
      const result = validateEmail('user @example.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject email exceeding maximum length (254 characters)', () => {
      const longEmail = 'a'.repeat(245) + '@example.com'; // 245 + 14 = 259 chars

      const result = validateEmail(longEmail);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('too long');
    });

    it('should accept valid email with special characters', () => {
      const result = validateEmail('user.name+tag@example-domain.com');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('validateDisplayName', () => {
    it('should reject XSS in display name', () => {
      const result = validateDisplayName('<script>alert("xss")</script>');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject too long display name', () => {
      const result = validateDisplayName('a'.repeat(101));

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('too long');
    });

    it('should accept safe display name', () => {
      const result = validateDisplayName('John Doe');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty display name', () => {
      const result = validateDisplayName('');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('required');
    });

    it('should reject whitespace-only display name', () => {
      const result = validateDisplayName('   ');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('required');
    });

    it('should reject javascript: protocol', () => {
      const result = validateDisplayName('javascript:alert(1)');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject onclick handler', () => {
      const result = validateDisplayName('Test<div onclick="alert(1)">Name');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject iframe tag', () => {
      const result = validateDisplayName('<iframe src="evil.com"></iframe>');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject SQL injection attempt', () => {
      const result = validateDisplayName("'; DROP TABLE users; --");

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject UNION SQL injection', () => {
      const result = validateDisplayName("admin' UNION SELECT * FROM users--");

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject data URL', () => {
      const result = validateDisplayName('data:text/html,<script>alert(1)</script>');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject eval function', () => {
      const result = validateDisplayName('eval("malicious code")');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept display name with accents and unicode', () => {
      const result = validateDisplayName('José María');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept display name with hyphens and apostrophes', () => {
      const result = validateDisplayName("O'Connor-Smith");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('validateRedirectUrl', () => {
    it('should accept valid http URL', () => {
      const result = validateRedirectUrl('http://example.com/callback');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid https URL', () => {
      const result = validateRedirectUrl('https://example.com/callback');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject javascript: protocol', () => {
      const result = validateRedirectUrl('javascript:alert(1)');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('protocol');
    });

    it('should reject ftp: protocol', () => {
      const result = validateRedirectUrl('ftp://example.com/file');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('protocol');
    });

    it('should reject malformed URL', () => {
      const result = validateRedirectUrl('not-a-url');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid URL');
    });

    it('should reject file: protocol', () => {
      const result = validateRedirectUrl('file:///etc/passwd');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('protocol');
    });

    it('should accept localhost URL', () => {
      const result = validateRedirectUrl('http://localhost:3000/auth/callback');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
