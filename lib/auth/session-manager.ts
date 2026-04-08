import { SupabaseClient } from '@supabase/supabase-js';
import { SECURITY_CONFIG } from '@/lib/config';

export interface SessionCheckResult {
  expired: boolean;
  warning: number | null;
}

export class checkSessionTimeout {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  async checkSessionTimeout(supabaseClient: SupabaseClient): Promise<SessionCheckResult> {
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (!session || error) {
      return {
        expired: true,
        warning: null
      };
    }

    const lastActivity = new Date(session.user.last_sign_in_at);
    const timeout = SECURITY_CONFIG.session.timeout * 1000; // Convert to milliseconds
    const warningThreshold = SECURITY_CONFIG.session.warningThreshold * 1000;
    const now = Date.now();

    const timeSinceActivity = now - lastActivity.getTime();
    const timeUntilTimeout = timeout - timeSinceActivity;

    // Check if session is expired
    if (timeSinceActivity >= timeout) {
      // Session expired
      await supabaseClient.auth.signOut();
      return {
        expired: true,
        warning: null
      };
    }

    // Check if session is approaching warning threshold (within warningThreshold seconds of expiration)
    if (timeUntilTimeout <= warningThreshold && timeUntilTimeout > 0) {
      // Session expiring soon, return warning with seconds until expiration
      const secondsUntilExpiration = Math.floor(timeUntilTimeout / 1000);
      return {
        expired: false,
        warning: secondsUntilExpiration
      };
    }

    // Session is valid and not approaching warning threshold
    return {
      expired: false,
      warning: null
    };
  }

  async handleExpiredSession(supabaseClient: SupabaseClient): Promise<void> {
    await supabaseClient.auth.signOut();
  }
}
