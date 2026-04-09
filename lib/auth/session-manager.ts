import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/app/types/database.types';
import { SECURITY_CONFIG } from '@/lib/config';
import { ActivityTracker, getActivityTracker } from './activity-tracker';
import {
  DEFAULT_SESSION_TIMEOUT_SECONDS,
  DEFAULT_SESSION_TIMEOUT_MS,
  SESSION_WARNING_THRESHOLD_SECONDS,
  SESSION_WARNING_THRESHOLD_MS
} from './constants';

export interface SessionCheckResult {
  expired: boolean;
  warning: number | null;
}

export class CheckSessionTimeout {
  private supabase: any;
  private activityTracker: ActivityTracker;

  constructor(supabaseClient: any, activityTracker?: ActivityTracker) {
    this.supabase = supabaseClient;
    this.activityTracker = activityTracker || getActivityTracker();
  }

  async checkSessionTimeout(supabaseClient: SupabaseClient<Database>): Promise<SessionCheckResult> {
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (!session || error) {
      return {
        expired: false,
        warning: null
      };
    }

    const userId = session.user.id;
    const timeout = DEFAULT_SESSION_TIMEOUT_MS; // Convert to milliseconds
    const warningThreshold = SESSION_WARNING_THRESHOLD_MS;

    // Check session validity using real activity tracking
    const isValidSession = await this.activityTracker.isSessionValid(userId);

    if (!isValidSession) {
      // Session expired based on actual activity
      await this.handleExpiredSession(supabaseClient);
      return {
        expired: true,
        warning: null
      };
    }

    // Get time until session expires
    const timeUntilExpiry = await this.activityTracker.getTimeUntilExpiry(userId);

    if (timeUntilExpiry === null) {
      return {
        expired: true,
        warning: null
      };
    }

    // Check if session is approaching warning threshold
    if (timeUntilExpiry <= warningThreshold && timeUntilExpiry > 0) {
      const secondsUntilExpiration = Math.floor(timeUntilExpiry / 1000);
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

  async handleExpiredSession(supabaseClient: SupabaseClient<Database>): Promise<void> {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user?.id) {
      // Clear activity record on session expiration
      await this.activityTracker.clearActivity(session.user.id);
    }
    await supabaseClient.auth.signOut();
  }

  /**
   * Update user activity (call this on user interactions)
   */
  async recordUserActivity(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.activityTracker.recordActivity(userId, ipAddress, userAgent);
  }
}
