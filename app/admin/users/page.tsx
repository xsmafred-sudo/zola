"use client"

import { LoaderPinwheelIcon, ShieldUserIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useState } from "react"

interface User {
  id: string
  email: string
  display_name: string | null
  role: string
  created_at: string | null
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users")
      if (!res.ok) throw new Error("Failed to fetch users")
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin"
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      })
      if (!res.ok) throw new Error("Failed to update role")
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      )
    } catch (err: any) {
      setError(err.message)
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.display_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-border border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={ShieldUserIcon} className="size-5" />
          <h1 className="text-xl font-semibold">User Management</h1>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage user accounts and roles
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-border bg-background text-foreground focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <HugeiconsIcon
              icon={LoaderPinwheelIcon}
              className="text-muted-foreground size-6 animate-spin"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className="border-border flex items-center justify-between rounded-lg border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    {u.display_name || "No name"}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {u.email}
                  </p>
                  {u.created_at && (
                    <p className="text-muted-foreground text-xs">
                      Joined: {new Date(u.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="ml-3 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      u.role === "admin"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {u.role}
                  </span>
                  <button
                    onClick={() => handleToggleRole(u.id, u.role)}
                    className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                  >
                    Toggle Role
                  </button>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {searchTerm ? "No users match your search" : "No users found."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
