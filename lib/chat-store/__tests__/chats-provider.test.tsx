import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { ChatsProvider, useChats } from '../chats/provider';
import * as api from '../chats/api';

// Mock the API and other components
jest.mock('../chats/api');
jest.mock('@/components/ui/toast', () => ({
  toast: jest.fn(),
}));

const TestComponent = () => {
  const { chats, createNewChat, updateTitle, deleteChat } = useChats();
  return (
    <div>
      <div data-testid="chats-count">{chats.length}</div>
      <button onClick={() => createNewChat('user-1', 'New Chat')}>Create Chat</button>
      <button onClick={() => updateTitle('1', 'Updated Title')}>Update Title</button>
      <button onClick={() => deleteChat('1')}>Delete Chat</button>
    </div>
  );
};

describe('ChatsProvider', () => {
  const mockUserId = 'user-1';
  const mockChats = [
    { id: '1', title: 'Chat 1', created_at: '2023-01-01', user_id: mockUserId, updated_at: '2023-01-01' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.getCachedChats as jest.Mock).mockResolvedValue([]);
    (api.fetchAndCacheChats as jest.Mock).mockResolvedValue(mockChats);
  });

  it('should load chats on mount', async () => {
    await act(async () => {
      render(
        <ChatsProvider userId={mockUserId}>
          <TestComponent />
        </ChatsProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('chats-count').textContent).toBe('1');
    });
    expect(api.fetchAndCacheChats).toHaveBeenCalledWith(mockUserId);
  });

  it('should create a new chat optimistically', async () => {
    (api.createNewChat as jest.Mock).mockResolvedValue({ 
      id: 'real-id', 
      title: 'New Chat',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    render(
      <ChatsProvider userId={mockUserId}>
        <TestComponent />
      </ChatsProvider>
    );

    // Click create button
    const createBtn = screen.getByText('Create Chat');
    await act(async () => {
      createBtn.click();
    });

    // Count should increase to 2 (1 original + 1 optimistic)
    // Wait for the total count to settle at 2 (the mock returns a real one which replaces the optimistic one)
    await waitFor(() => {
      expect(screen.getByTestId('chats-count').textContent).toBe('2');
    });

    expect(api.createNewChat).toHaveBeenCalled();
  });

  it('should roll back on create failed', async () => {
    (api.createNewChat as jest.Mock).mockRejectedValue(new Error('Failed'));

    render(
      <ChatsProvider userId={mockUserId}>
        <TestComponent />
      </ChatsProvider>
    );

    const createBtn = screen.getByText('Create Chat');
    await act(async () => {
      createBtn.click();
    });

    // Should briefly show 2, then back to 1
    await waitFor(() => {
      expect(screen.getByTestId('chats-count').textContent).toBe('1');
    });
  });

  it('should update title optimistically', async () => {
    (api.updateChatTitle as jest.Mock).mockResolvedValue(undefined);

    render(
      <ChatsProvider userId={mockUserId}>
        <TestComponent />
      </ChatsProvider>
    );

    const updateBtn = screen.getByText('Update Title');
    await act(async () => {
      updateBtn.click();
    });

    expect(api.updateChatTitle).toHaveBeenCalledWith('1', 'Updated Title');
  });
});
