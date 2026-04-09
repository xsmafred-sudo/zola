import { 
  fetchUserProfile, 
  updateUserProfile, 
  signOutUser 
} from '../api';
import { createClient } from '@/lib/supabase/client';

// Mock the dependencies
jest.mock('@/lib/supabase/client');
jest.mock('@/components/ui/toast', () => ({
  toast: jest.fn(),
}));

describe('User Store API', () => {
  const mockUserId = 'test-user-id';
  const mockProfile = { 
    id: mockUserId, 
    email: 'test@example.com', 
    display_name: 'Test User',
    anonymous: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchUserProfile', () => {
    it('should fetch user profile from Supabase', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
      } as any;
      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const result = await fetchUserProfile(mockUserId);

      expect(result).toEqual({
        ...mockProfile,
        profile_image: '',
        display_name: 'Test User',
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', mockUserId);
    });

    it('should return null for anonymous users', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: { ...mockProfile, anonymous: true }, 
          error: null 
        }),
      } as any;
      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const result = await fetchUserProfile(mockUserId);
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: new Error('Fail') }),
      } as any;
      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const result = await fetchUserProfile(mockUserId);
      expect(result).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile in Supabase', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      } as any;
      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const success = await updateUserProfile(mockUserId, { display_name: 'New Name' });

      expect(success).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith({ display_name: 'New Name' });
    });
  });

  describe('signOutUser', () => {
    it('should call supabase.auth.signOut', async () => {
      const mockSupabase = {
        auth: {
          signOut: jest.fn().mockResolvedValue({ error: null }),
        },
      } as any;
      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const success = await signOutUser();

      expect(success).toBe(true);
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });
  });
});
