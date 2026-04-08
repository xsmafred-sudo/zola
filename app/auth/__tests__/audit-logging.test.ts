import { AuditLogger } from '@/lib/auth/audit-logger';
import { mockSupabaseClient } from './helpers/mocks';

describe('AuditLogger', () => {
  it('should log login success event', async () => {
    const logger = new AuditLogger(mockSupabaseClient as any);
    mockSupabaseClient.from.mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: null }),
    });

    await logger.logLoginSuccess('user-id', 'user@example.com', '192.168.1.1', 'Mozilla/5.0');

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('auth_audit_log');
    expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith({
      event_type: 'login_success',
      user_id: 'user-id',
      email: 'user@example.com',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      timestamp: expect.any(String),
      metadata: {}
    });
  });

  it('should log login failure event', async () => {
    const logger = new AuditLogger(mockSupabaseClient as any);
    mockSupabaseClient.from.mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: null }),
    });

    await logger.logLoginFailure('user@example.com', '192.168.1.1', 'Mozilla/5.0', 'Invalid credentials');

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('auth_audit_log');
    expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith({
      event_type: 'login_failure',
      user_id: null,
      email: 'user@example.com',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      timestamp: expect.any(String),
      metadata: { reason: 'Invalid credentials' }
    });
  });

  it('should log OAuth login event', async () => {
    const logger = new AuditLogger(mockSupabaseClient as any);
    mockSupabaseClient.from.mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: null }),
    });

    await logger.logOAuthLogin('user-id', 'user@example.com', 'google', '192.168.1.1', 'Mozilla/5.0');

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('auth_audit_log');
    expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith({
      event_type: 'oauth_login',
      user_id: 'user-id',
      email: 'user@example.com',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      timestamp: expect.any(String),
      metadata: { provider: 'google' }
    });
  });

  it('should log account lockout event', async () => {
    const logger = new AuditLogger(mockSupabaseClient as any);
    mockSupabaseClient.from.mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: null }),
    });

    await logger.logAccountLockout('user@example.com', '192.168.1.1', 'Mozilla/5.0', 5);

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('auth_audit_log');
    expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith({
      event_type: 'account_lockout',
      user_id: null,
      email: 'user@example.com',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      timestamp: expect.any(String),
      metadata: { lockout_duration_minutes: 5 }
    });
  });
});
