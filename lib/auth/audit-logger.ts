import { SupabaseClient } from '@supabase/supabase-js';

export interface AuthEvent {
  eventType: 'login_success' | 'login_failure' | 'oauth_login' |
            'password_reset' | 'account_lockout' | 'csrf_validation_failure' |
            'rate_limit_violation' | 'session_timeout';
  userId: string | null;
  email?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class AuditLogger {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  async logEvent(event: AuthEvent): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('auth_audit_log')
        .insert({
          event_type: event.eventType,
          user_id: event.userId,
          email: event.email,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          timestamp: event.timestamp.toISOString(),
          metadata: event.metadata || {}
        });

      if (error) {
        console.error('Failed to log auth event:', error);
      }
    } catch (error) {
      console.error('Exception in audit logging:', error);
    }
  }

  async logLoginSuccess(
    userId: string,
    email: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'login_success',
      userId,
      email,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });
  }

  async logLoginFailure(
    email: string,
    ipAddress: string,
    userAgent: string,
    reason: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'login_failure',
      userId: null,
      email,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      metadata: { reason }
    });
  }

  async logOAuthLogin(
    userId: string,
    email: string,
    provider: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'oauth_login',
      userId,
      email,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      metadata: { provider }
    });
  }

  async logPasswordReset(
    email: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'password_reset',
      userId: null,
      email,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });
  }

  async logAccountLockout(
    email: string,
    ipAddress: string,
    userAgent: string,
    lockoutDurationMinutes: number
  ): Promise<void> {
    await this.logEvent({
      eventType: 'account_lockout',
      userId: null,
      email,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      metadata: { lockout_duration_minutes: lockoutDurationMinutes }
    });
  }

  async logCsrfValidationFailure(
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'csrf_validation_failure',
      userId: null,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });
  }

  async logRateLimitViolation(
    email: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'rate_limit_violation',
      userId: null,
      email,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });
  }

  async logSessionTimeout(
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'session_timeout',
      userId,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });
  }
}
