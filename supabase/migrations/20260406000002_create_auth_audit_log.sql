-- Migration: Create auth_audit_log table for security audit trail
-- This table tracks all authentication-related security events for monitoring and incident response

-- Create auth_audit_log table
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Indexes for common queries
  INDEX idx_auth_audit_log_event_type (event_type),
  INDEX idx_auth_audit_log_user_id (user_id),
  INDEX idx_auth_audit_log_email (email),
  INDEX idx_auth_audit_log_timestamp (timestamp),
  INDEX idx_auth_audit_log_ip_address (ip_address),

  -- Composite index for user activity monitoring
  INDEX idx_auth_audit_log_user_timestamp (user_id, timestamp),
  INDEX idx_auth_audit_log_email_timestamp (email, timestamp)
);

-- Add comment to table
COMMENT ON TABLE auth_audit_log IS 'Security audit log for authentication events including login attempts, OAuth flows, and account lockouts';

-- Add comments to columns
COMMENT ON COLUMN auth_audit_log.event_type IS 'Type of security event: login_success, login_failure, oauth_login, account_lockout, etc.';
COMMENT ON COLUMN auth_audit_log.user_id IS 'Reference to the auth.users table (can be null for failed logins)';
COMMENT ON COLUMN auth_audit_log.email IS 'Email address associated with the event (for failed auth attempts)';
COMMENT ON COLUMN auth_audit_log.ip_address IS 'IP address of the client making the request';
COMMENT ON COLUMN auth_audit_log.user_agent IS 'User agent string from client request';
COMMENT ON COLUMN auth_audit_log.timestamp IS 'When the security event occurred';
COMMENT ON COLUMN auth_audit_log.metadata IS 'Additional context about the event (e.g., lockout duration, OAuth provider)';

-- Enable Row Level Security (RLS)
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies to control access to audit logs
-- Only admins and the user themselves can view their own audit logs
CREATE POLICY "Users can view their own audit logs"
  ON auth_audit_log
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Only system/trigger functions can insert audit logs
CREATE POLICY "System can insert audit logs"
  ON auth_audit_log
  FOR INSERT
  WITH CHECK (true);