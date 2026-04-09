import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { UserProvider, useUser } from '../provider';
import * as api from '../api';

// Mock the API
jest.mock('../api');

const TestComponent = () => {
  const { user, updateUser, signOut, refreshUser } = useUser();
  return (
    <div>
      <div data-testid="user-name">{user?.display_name || 'Guest'}</div>
      <button onClick={() => updateUser({ display_name: 'Updated Name' })}>Update Profile</button>
      <button onClick={() => signOut()}>Sign Out</button>
      <button onClick={() => refreshUser()}>Refresh</button>
    </div>
  );
};

describe('UserProvider', () => {
  const mockUser = { 
    id: 'user-1', 
    email: 'test@example.com', 
    display_name: 'Original Name' 
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with provided user', () => {
    render(
      <UserProvider initialUser={mockUser as any}>
        <TestComponent />
      </UserProvider>
    );

    expect(screen.getByTestId('user-name').textContent).toBe('Original Name');
  });

  it('should update user profile state', async () => {
    (api.updateUserProfile as jest.Mock).mockResolvedValue(true);

    render(
      <UserProvider initialUser={mockUser as any}>
        <TestComponent />
      </UserProvider>
    );

    const updateBtn = screen.getByText('Update Profile');
    await act(async () => {
      updateBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-name').textContent).toBe('Updated Name');
    });
    expect(api.updateUserProfile).toHaveBeenCalledWith('user-1', { display_name: 'Updated Name' });
  });

  it('should refresh user data', async () => {
    const freshUser = { ...mockUser, display_name: 'Fresh Name' };
    (api.fetchUserProfile as jest.Mock).mockResolvedValue(freshUser);

    render(
      <UserProvider initialUser={mockUser as any}>
        <TestComponent />
      </UserProvider>
    );

    const refreshBtn = screen.getByText('Refresh');
    await act(async () => {
      refreshBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-name').textContent).toBe('Fresh Name');
    });
    expect(api.fetchUserProfile).toHaveBeenCalledWith('user-1');
  });

  it('should clear user on sign out', async () => {
    (api.signOutUser as jest.Mock).mockResolvedValue(true);

    render(
      <UserProvider initialUser={mockUser as any}>
        <TestComponent />
      </UserProvider>
    );

    const signOutBtn = screen.getByText('Sign Out');
    await act(async () => {
      signOutBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-name').textContent).toBe('Guest');
    });
    expect(api.signOutUser).toHaveBeenCalled();
  });
});
