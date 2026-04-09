import { 
  getChatsForUserInDb, 
  fetchAndCacheChats, 
  getCachedChats, 
  updateChatTitle 
} from '../chats/api';
import { readFromIndexedDB, writeToIndexedDB } from '@/lib/chat-store/persist';
import { createClient } from '@/lib/supabase/client';

// Mock the dependencies
jest.mock('@/lib/chat-store/persist');
jest.mock('@/lib/supabase/client');
jest.mock('@/lib/supabase/config', () => ({
  isSupabaseEnabled: jest.fn().mockReturnValue(true),
}));

describe('Chat Store API', () => {
  const mockUserId = 'test-user-id';
  const mockChats = [
    { id: '1', title: 'Chat 1', created_at: '2023-01-01', user_id: mockUserId },
    { id: '2', title: 'Chat 2', created_at: '2023-01-02', user_id: mockUserId },
  ];

  const createMockSupabase = (resolvedValue: any) => {
    const mock: any = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation((callback) => {
        return Promise.resolve(callback(resolvedValue));
      }),
    };
    return mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getChatsForUserInDb', () => {
    it('should fetch chats from Supabase', async () => {
      const mockSupabase = createMockSupabase({ data: mockChats, error: null });
      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const result = await getChatsForUserInDb(mockUserId);

      expect(result).toEqual(mockChats);
      expect(mockSupabase.from).toHaveBeenCalledWith('chats');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', mockUserId);
    });

    it('should return empty array on database error', async () => {
      const mockSupabase = createMockSupabase({ data: null, error: new Error('DB Error') });
      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const result = await getChatsForUserInDb(mockUserId);
      expect(result).toEqual([]);
    });
  });

  describe('fetchAndCacheChats', () => {
    it('should fetch from DB and write to IndexedDB', async () => {
      const mockSupabase = createMockSupabase({ data: mockChats, error: null });
      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const result = await fetchAndCacheChats(mockUserId);

      expect(result).toEqual(mockChats);
      expect(writeToIndexedDB).toHaveBeenCalledWith('chats', mockChats);
    });
  });

  describe('getCachedChats', () => {
    it('should read from IndexedDB and sort by date', async () => {
      (readFromIndexedDB as jest.Mock).mockResolvedValue(mockChats);

      const result = await getCachedChats();

      // Should be sorted by created_at DESC
      expect(result[0].id).toBe('2');
      expect(result[1].id).toBe('1');
    });
  });

  describe('updateChatTitle', () => {
    it('should update in DB and then refresh cache', async () => {
      const mockSupabase = createMockSupabase({ error: null });
      (createClient as jest.Mock).mockReturnValue(mockSupabase);
      (readFromIndexedDB as jest.Mock).mockResolvedValue(mockChats);

      await updateChatTitle('1', 'New Title');

      expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Title' }));
      expect(writeToIndexedDB).toHaveBeenCalled(); // Cache refresh
    });
  });
});
