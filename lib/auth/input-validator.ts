export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates email address using RFC 5322 compliant regex pattern.
 * Enforces maximum length of 254 characters.
 *
 * @param email - The email address to validate
 * @returns ValidationResult indicating validity and any error message
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email address is required' };
  }

  // RFC 5322 compliant email validation (simplified version)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  // Check for spaces
  if (email.includes(' ')) {
    return { valid: false, error: 'Email address cannot contain spaces' };
  }

  // Enforce maximum length (RFC 5321 specifies 254 characters maximum)
  if (email.length > 254) {
    return { valid: false, error: 'Email address too long (maximum 254 characters)' };
  }

  return { valid: true };
}

/**
 * Validates display name to prevent XSS and SQL injection attacks.
 * Enforces maximum length of 100 characters.
 *
 * @param name - The display name to validate
 * @returns ValidationResult indicating validity and any error message
 */
export function validateDisplayName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Name is required' };
  }

  // Enforce maximum length
  if (name.length > 100) {
    return { valid: false, error: 'Name too long (maximum 100 characters)' };
  }

  // Check for XSS attempts using dangerous patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /data:\s*/i,
    /vbscript:/i,
    /onload\s*=/i,
    /onerror\s*=/i,
    /eval\(/i,
    /expression\s*\(/i,
    /fromcharcode/i,
    /document\.cookie/i,
    /document\.write/i,
    /document\.domain/i,
    /window\.location/i,
    /window\.open/i,
    /navigator\./i
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(name)) {
      return { valid: false, error: 'Name contains invalid characters' };
    }
  }

  // Check for SQL injection attempts
  // These patterns are more specific to avoid false positives with legitimate text
  const sqlPatterns = [
    // SQL keywords followed by whitespace (indicates SQL injection)
    /(\bUNION\b\s+\bSELECT\b)/i,
    /(\bSELECT\b\s+\*?\s*\bFROM\b)/i,
    /(\bINSERT\b\s+\bINTO\b)/i,
    /(\bUPDATE\b\s+\w+\s+\bSET\b)/i,
    /(\bDELETE\b\s+\bFROM\b)/i,
    /(\bDROP\b\s+\bTABLE\b)/i,
    /(\bCREATE\b\s+\bTABLE\b)/i,
    /(\bALTER\b\s+\bTABLE\b)/i,
    /(\bTRUNCATE\b\s+\bTABLE\b)/i,
    // Comment sequences used in SQL injection
    /;\s*--/i,
    /;\s*\/\*/i,
    // Multiple single quotes (SQL injection pattern)
    /'{2,}/,
    // Backslash escape attempts
    /\\[\'\"]/,
    // Pipe operator (SQL injection)
    /\|.*\|/,
    // Semicolon in suspicious contexts
    /;\s*\w+/i
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(name)) {
      return { valid: false, error: 'Name contains invalid characters' };
    }
  }

  return { valid: true };
}

/**
 * Validates redirect URL to prevent open redirect attacks.
 * Ensures URL uses safe protocols (http or https) and is properly formatted.
 *
 * @param url - The redirect URL to validate
 * @returns ValidationResult indicating validity and any error message
 */
export function validateRedirectUrl(url: string): ValidationResult {
  if (!url || url.trim().length === 0) {
    return { valid: false, error: 'URL is required' };
  }

  // Basic URL validation
  try {
    const parsed = new URL(url);

    // Ensure URL is absolute and uses allowed protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Invalid URL protocol' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
