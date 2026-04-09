-- Migration: Create password history and security settings tables
-- This migration adds tables for password rotation policies and user security preferences

-- Create password history table to prevent password reuse
CREATE TABLE IF NOT EXISTS password_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by VARCHAR(50) DEFAULT 'user' -- 'user', 'admin_reset', or 'system'
);

-- Create indexes for password history queries
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_changed_at ON password_history(changed_at);
-- Unique constraint to prevent exact password reuse (optional, adjust based on policy)
CREATE INDEX IF NOT EXISTS idx_password_history_user_hash ON password_history(user_id, password_hash);

-- Add comments to password_history table
COMMENT ON TABLE password_history IS 'Tracks password changes to prevent reuse and support security policies';
COMMENT ON COLUMN password_history.user_id IS 'Reference to auth.users table';
COMMENT ON COLUMN password_history.password_hash IS 'Hash of password (not the actual password)';
COMMENT ON COLUMN password_history.changed_at IS 'When the password was changed';
COMMENT ON COLUMN password_history.created_by IS 'Who changed the password: user, admin_reset, or system';

-- Create user_security_settings table for individual security preferences
CREATE TABLE IF NOT EXISTS user_security_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Security preferences
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_method VARCHAR(20), -- 'totp', 'sms', 'email', or 'hardware'
  mfa_secret VARCHAR(255), -- For TOTP setup (encrypted)
  recovery_codes TEXT[], -- Backup codes for MFA recovery
  recovery_codes_used INTEGER[] DEFAULT '{}',

  -- Session preferences
  remember_me_enabled BOOLEAN DEFAULT false,
  session_timeout_minutes INTEGER DEFAULT 30, -- Individual override of system default
  concurrent_sessions INTEGER DEFAULT 3, -- Max allowed concurrent sessions
  last_password_change_required BOOLEAN DEFAULT false,

  -- Security notifications
  email_on_login BOOLEAN DEFAULT true,
  email_on_new_device BOOLEAN DEFAULT true,
  email_on_password_change BOOLEAN DEFAULT true,
  sms_on_security_events BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for user_security_settings
CREATE INDEX IF NOT EXISTS idx_user_security_settings_user_id ON user_security_settings(user_id);

-- Add comments to user_security_settings table
COMMENT ON TABLE user_security_settings IS 'Individual user security preferences and MFA settings';
COMMENT ON COLUMN user_security_settings.mfa_enabled IS 'Whether multi-factor authentication is enabled';
COMMENT ON COLUMN user_security_settings.mfa_method IS 'Type of MFA being used';
COMMENT ON COLUMN user_security_settings.mfa_secret IS 'Encrypted secret for TOTP MFA';
COMMENT ON COLUMN user_security_settings.recovery_codes IS 'Backup recovery codes for MFA';
COMMENT ON COLUMN user_security_settings.remember_me_enabled IS 'Whether user has remember-me enabled';
COMMENT ON COLUMN user_security_settings.session_timeout_minutes IS 'Custom session timeout (overrides system default)';
COMMENT ON COLUMN user_security_settings.concurrent_sessions IS 'Maximum allowed concurrent active sessions';
COMMENT ON COLUMN user_security_settings.email_on_login IS 'Send email notification on new login';
COMMENT ON COLUMN user_security_settings.email_on_new_device IS 'Send email notification on login from new device';
COMMENT ON COLUMN user_security_settings.email_on_password_change IS 'Send email notification when password changes';

-- Create device tracking table for security monitoring
CREATE TABLE IF NOT EXISTS user_devices (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Device identification
  device_name VARCHAR(255), -- 'iPhone 13', 'Chrome on Windows', etc.
  device_type VARCHAR(50), -- 'mobile', 'desktop', or 'tablet'
  platform VARCHAR(100), -- 'iOS', 'Android', 'Windows', 'macOS', 'Linux'
  browser VARCHAR(100), -- 'Chrome', 'Safari', 'Firefox', etc.

  -- Network info
  ip_address INET NOT NULL,
  location_country VARCHAR(100),
  location_city VARCHAR(100),

  -- Session info
  user_agent TEXT,
  is_current BOOLEAN DEFAULT false,

  -- Timestamps
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for user_devices
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_ip_address ON user_devices(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_seen_at ON user_devices(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_user_devices_is_current ON user_devices(is_current);

-- Add comments to user_devices table
COMMENT ON TABLE user_devices IS 'Tracks user devices and sessions for security monitoring';
COMMENT ON COLUMN user_devices.device_name IS 'Human-readable device name';
COMMENT ON COLUMN user_devices.device_type IS 'Device type: mobile, desktop, or tablet';
COMMENT ON COLUMN user_devices.ip_address IS 'IP address of the device';
COMMENT ON COLUMN user_devices.user_agent IS 'Browser user agent string';
COMMENT ON COLUMN user_devices.is_current IS 'Whether this is the currently active session';
COMMENT ON COLUMN user_devices.first_seen_at IS 'When this device was first registered';
COMMENT ON COLUMN user_devices.last_seen_at IS 'When this device was last active';

-- Create function to automatically mark non-current devices as inactive
CREATE OR REPLACE FUNCTION mark_inactive_devices(user_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_devices
  SET
    is_current = false
  WHERE user_id = user_param
    AND is_current = true
    AND id != (
      -- Keep the most recently active device as current
      SELECT id
      FROM user_devices
      WHERE user_id = user_param
      ORDER BY last_active_at DESC
      LIMIT 1
    );
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single "current" device per user
-- This ensures that only one device is marked as current at a time
CREATE OR REPLACE FUNCTION enforce_single_current_device()
RETURNS TRIGGER AS $$
BEGIN
  -- When marking a device as current, first mark all other devices as not current
  IF NEW.is_current = true THEN
    UPDATE user_devices
    SET is_current = false
    WHERE user_id = NEW.user_id
    AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single current device
DROP TRIGGER IF EXISTS enforce_single_current_device_trigger ON user_devices;
CREATE TRIGGER enforce_single_current_device_trigger
  BEFORE INSERT OR UPDATE ON user_devices
  FOR EACH ROW
  WHEN NEW.is_current = true
  EXECUTE FUNCTION enforce_single_current_device();

-- Enable Row Level Security (RLS) for security tables
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for password_history
-- Users can only see their own password history
CREATE POLICY "Users can view their own password history"
  ON password_history
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert password history"
  ON password_history
  FOR INSERT
  WITH CHECK (true);

-- Create RLS policies for user_security_settings
-- Users can only view their own security settings
CREATE POLICY "Users can view their own security settings"
  ON user_security_settings
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own security settings"
  ON user_security_settings
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert security settings"
  ON user_security_settings
  FOR INSERT
  WITH CHECK (true);

-- Create RLS policies for user_devices
-- Users can only see their own devices
CREATE POLICY "Users can view their own devices"
  ON user_devices
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own devices"
  ON user_devices
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own devices"
  ON user_devices
  FOR UPDATE
  USING (user_id = auth.uid());