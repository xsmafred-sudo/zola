-- Migration: Add security tracking fields to users table
-- This migration adds fields for enhanced security monitoring and user activity tracking

-- Add last_active_at column for session timeout tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

-- Add failed_login_attempts column for account lockout tracking (as backup to Redis)
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;

-- Add last_failed_login_at column for account lockout tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMP WITH TIME ZONE;

-- Add account_locked_until column for account lockout status
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP WITH TIME ZONE;

-- Add password_changed_at column for password rotation tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;

-- Add email_verified_at column for email verification tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

-- Add terms_accepted_at column for compliance tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;

-- Add privacy_accepted_at column for GDPR compliance tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for security queries
CREATE INDEX IF NOT EXISTS idx_users_last_active_at ON users(last_active_at);
CREATE INDEX IF NOT EXISTS idx_users_account_locked_until ON users(account_locked_until);
CREATE INDEX IF NOT EXISTS idx_users_email_verified_at ON users(email_verified_at);

-- Add comments to new columns
COMMENT ON COLUMN users.last_active_at IS 'Timestamp of user''s last activity for session timeout enforcement';
COMMENT ON COLUMN users.failed_login_attempts IS 'Count of consecutive failed login attempts (used with Redis-based lockout)';
COMMENT ON COLUMN users.last_failed_login_at IS 'Timestamp of most recent failed login attempt';
COMMENT ON COLUMN users.account_locked_until IS 'Timestamp until which account is locked due to failed attempts';
COMMENT ON COLUMN users.password_changed_at IS 'Timestamp when password was last changed';
COMMENT ON COLUMN users.email_verified_at IS 'Timestamp when user email was verified';
COMMENT ON COLUMN users.terms_accepted_at IS 'Timestamp when user accepted terms of service';
COMMENT ON COLUMN users.privacy_accepted_at IS 'Timestamp when user accepted privacy policy';

-- Create a function to update last_active_at timestamp
CREATE OR REPLACE FUNCTION update_user_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_active_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update last_active_at on user updates
DROP TRIGGER IF EXISTS update_users_last_active ON users;
CREATE TRIGGER update_users_last_active
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_activity();

-- Create a function to reset failed login attempts on successful login
CREATE OR REPLACE FUNCTION reset_failed_login_attempts()
RETURNS TRIGGER AS $$
BEGIN
  -- Reset failed attempts on successful login/session update
  IF NEW.failed_login_attempts = 0 OR OLD.failed_login_attempts IS NULL THEN
    -- Already reset or never had failed attempts
    RETURN NEW;
  END IF;

  -- Reset failed attempts and lockout status on successful activity
  NEW.failed_login_attempts = 0;
  NEW.last_failed_login_at = NULL;
  NEW.account_locked_until = NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment failed login attempts
CREATE OR REPLACE FUNCTION increment_failed_login_attempts()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if not already locked
  IF NEW.account_locked_until IS NOT NULL AND NEW.account_locked_until > NOW() THEN
    RETURN NEW;
  END IF;

  -- Increment failed attempts
  NEW.failed_login_attempts = COALESCE(OLD.failed_login_attempts, 0) + 1;
  NEW.last_failed_login_at = NOW();

  -- Check if lockout threshold is reached
  IF NEW.failed_login_attempts >= 5 THEN
    NEW.account_locked_until = NOW() + INTERVAL '15 minutes';
  ELSEIF NEW.failed_login_attempts >= 3 THEN
    NEW.account_locked_until = NOW() + INTERVAL '5 minutes';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to increment failed login attempts on auth failures
-- This trigger would be called by authentication logic when login fails
CREATE OR REPLACE FUNCTION record_login_failure(user_email TEXT, user_ip INET)
RETURNS VOID AS $$
BEGIN
  -- Log to audit table
  INSERT INTO auth_audit_log (event_type, email, ip_address, timestamp, metadata)
  VALUES ('login_failure', user_email, user_ip, NOW(), '{"automatic": true}');

  -- Update user record with failed attempt
  UPDATE users
  SET
    failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1,
    last_failed_login_at = NOW(),
    account_locked_until = CASE
      WHEN COALESCE(failed_login_attempts, 0) + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
      WHEN COALESCE(failed_login_attempts, 0) + 1 >= 3 THEN NOW() + INTERVAL '5 minutes'
      ELSE NULL
    END
  WHERE email = user_email;

  -- Log account lockout if triggered
  IF COALESCE(failed_login_attempts, 0) + 1 >= 3 THEN
    INSERT INTO auth_audit_log (event_type, email, ip_address, timestamp, metadata)
    VALUES (
      'account_lockout',
      user_email,
      user_ip,
      NOW(),
      jsonb_build_object(
        'lockout_duration_minutes', CASE
          WHEN COALESCE(failed_login_attempts, 0) + 1 >= 5 THEN 15
          ELSE 5
        END,
        'triggered_by', 'database_trigger'
      )
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;