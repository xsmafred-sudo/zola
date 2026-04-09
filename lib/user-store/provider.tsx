// app/providers/user-provider.tsx
"use client"

import {
  addLead as apiAddLead,
  fetchUserProfile,
  signOutUser,
  subscribeToUserUpdates,
  updateUserProfile,
} from "@/lib/user-store/api"
import type { Lead } from "@/lib/user-store/lead-types"
import type { UserProfile } from "@/lib/user/types"
import { createContext, useContext, useEffect, useState } from "react"

type UserContextType = {
  user: UserProfile | null
  isLoading: boolean
  updateUser: (updates: Partial<UserProfile>) => Promise<void>
  refreshUser: () => Promise<void>
  signOut: () => Promise<void>
  addLead: (
    lead: Omit<Lead, "id" | "createdAt" | "updatedAt" | "user_id">
  ) => Promise<boolean>
  updateLead: (leadId: string, updates: Partial<Lead>) => Promise<boolean>
  deleteLead: (leadId: string) => Promise<boolean>
  getLeads: (filters?: any) => Promise<Lead[]>
  bulkUpdateLeads: (
    leadIds: string[],
    updates: Partial<Lead>
  ) => Promise<boolean>
  bulkDeleteLeads: (leadIds: string[]) => Promise<boolean>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser: UserProfile | null
}) {
  const [user, setUser] = useState<UserProfile | null>(initialUser)
  const [isLoading, setIsLoading] = useState(false)

  const refreshUser = async () => {
    if (!user?.id) return

    setIsLoading(true)
    try {
      const updatedUser = await fetchUserProfile(user.id)
      if (updatedUser) setUser(updatedUser)
    } finally {
      setIsLoading(false)
    }
  }

  const updateUser = async (updates: Partial<UserProfile>) => {
    if (!user?.id) return

    setIsLoading(true)
    try {
      const success = await updateUserProfile(user.id, updates)
      if (success) {
        setUser((prev) => (prev ? { ...prev, ...updates } : null))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    setIsLoading(true)
    try {
      const success = await signOutUser()
      if (success) setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Lead management methods
  const addLead = async (
    lead: Omit<Lead, "id" | "createdAt" | "updatedAt" | "user_id">
  ) => {
    if (!user?.id) return false

    setIsLoading(true)
    try {
      const success = await apiAddLead({
        ...lead,
        user_id: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      return success
    } finally {
      setIsLoading(false)
    }
  }

  const updateLead = async (leadId: string, updates: Partial<Lead>) => {
    setIsLoading(true)
    try {
      // TODO: Implement updateLead API function
      console.log("Updating lead:", leadId, updates)
      return true
    } finally {
      setIsLoading(false)
    }
  }

  const deleteLead = async (leadId: string) => {
    setIsLoading(true)
    try {
      // TODO: Implement deleteLead API function
      console.log("Deleting lead:", leadId)
      return true
    } finally {
      setIsLoading(false)
    }
  }

  const getLeads = async (filters?: any) => {
    setIsLoading(true)
    try {
      // TODO: Implement getLeads API function
      console.log("Fetching leads with filters:", filters)
      return []
    } finally {
      setIsLoading(false)
    }
  }

  const bulkUpdateLeads = async (leadIds: string[], updates: Partial<Lead>) => {
    setIsLoading(true)
    try {
      // TODO: Implement bulkUpdateLeads API function
      console.log("Bulk updating leads:", leadIds, updates)
      return true
    } finally {
      setIsLoading(false)
    }
  }

  const bulkDeleteLeads = async (leadIds: string[]) => {
    setIsLoading(true)
    try {
      // TODO: Implement bulkDeleteLeads API function
      console.log("Bulk deleting leads:", leadIds)
      return true
    } finally {
      setIsLoading(false)
    }
  }

  // Set up realtime subscription for user data changes
  useEffect(() => {
    if (!user?.id) return

    const unsubscribe = subscribeToUserUpdates(user.id, (newData) => {
      setUser((prev) => (prev ? { ...prev, ...newData } : null))
    })

    return () => {
      unsubscribe()
    }
  }, [user?.id])

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        updateUser,
        refreshUser,
        signOut,
        addLead,
        updateLead,
        deleteLead,
        getLeads,
        bulkUpdateLeads,
        bulkDeleteLeads,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

// Custom hook to use the user context
export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
