"use client"

import { Avatar } from "@/components/ui/avatar"
import { Link } from "@/components/ui/link"
import {
  Sidebar,
  SidebarContent,
  SidebarDisclosure,
  SidebarDisclosureGroup,
  SidebarDisclosurePanel,
  SidebarDisclosureTrigger,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarRail,
  SidebarSection,
  SidebarSectionGroup,
  useSidebar,
} from "@/components/ui/sidebar"
import { SmoothDropdown } from "@/components/ui/smooth-dropdown"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useUser } from "@/lib/user-store/provider"
import { PlusIcon } from "@heroicons/react/24/outline"
import {
  ChatBubbleLeftRightIcon,
  Cog8ToothIcon,
  FolderIcon,
  HomeIcon,
  ListBulletIcon,
  ShieldCheckIcon,
  StarIcon,
  UsersIcon,
} from "@heroicons/react/24/solid"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"

export default function AppSidebar(
  props: React.ComponentProps<typeof Sidebar>
) {
  const { chats, pinnedChats } = useChats()
  const { user } = useUser()
  const pathname = usePathname()
  const { state } = useSidebar()
  const [adminOpen, setAdminOpen] = useState(false)

  const isAdmin = (user as any)?.role === "admin"

  const recentChats = useMemo(
    () => chats.filter((c) => !c.pinned && !c.project_id).slice(0, 10),
    [chats]
  )

  const projectChats = useMemo(() => chats.filter((c) => c.project_id), [chats])

  const projects = useMemo(() => {
    const projectMap = new Map()
    projectChats.forEach((chat) => {
      if (chat.project_id && !projectMap.has(chat.project_id)) {
        projectMap.set(chat.project_id, {
          id: chat.project_id,
          name: `Project ${chat.project_id.slice(0, 8)}`,
          count: 1,
        })
      } else if (chat.project_id) {
        const project = projectMap.get(chat.project_id)
        project.count += 1
      }
    })
    return Array.from(projectMap.values())
  }, [projectChats])

  const currentChatId = pathname.startsWith("/c/")
    ? pathname.replace("/c/", "")
    : null

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-x-2">
          <Avatar
            isSquare
            size="sm"
            className="outline-hidden"
            src="/favicon.ico"
          />
          <SidebarLabel className="font-medium">Zola</SidebarLabel>
        </Link>
        <SidebarItem href="/" tooltip="New Chat" isCurrent={pathname === "/"}>
          <PlusIcon />
          <SidebarLabel>New Chat</SidebarLabel>
        </SidebarItem>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSectionGroup>
          <SidebarSection label="Chats">
            {pinnedChats.length > 0 && (
              <SidebarDisclosureGroup defaultExpandedKeys={["pinned"]}>
                <SidebarDisclosure id="pinned">
                  <SidebarDisclosureTrigger>
                    <StarIcon />
                    <SidebarLabel>Pinned</SidebarLabel>
                  </SidebarDisclosureTrigger>
                  <SidebarDisclosurePanel>
                    {pinnedChats.map((chat) => (
                      <SidebarItem
                        key={chat.id}
                        href={`/c/${chat.id}`}
                        tooltip={chat.title || "Untitled"}
                        isCurrent={currentChatId === chat.id}
                      >
                        <ChatBubbleLeftRightIcon />
                        <SidebarLabel>{chat.title || "Untitled"}</SidebarLabel>
                      </SidebarItem>
                    ))}
                  </SidebarDisclosurePanel>
                </SidebarDisclosure>
              </SidebarDisclosureGroup>
            )}

            {recentChats.map((chat) => (
              <SidebarItem
                key={chat.id}
                href={`/c/${chat.id}`}
                tooltip={chat.title || "Untitled"}
                isCurrent={currentChatId === chat.id}
              >
                <ChatBubbleLeftRightIcon />
                <SidebarLabel>{chat.title || "Untitled"}</SidebarLabel>
              </SidebarItem>
            ))}

            {recentChats.length === 0 && pinnedChats.length === 0 && (
              <div className="text-muted-fg px-4 py-2 text-sm group-data-[state=collapsed]:hidden">
                No chats yet
              </div>
            )}
          </SidebarSection>

          {projects.length > 0 && (
            <SidebarSection label="Projects">
              {projects.map((project) => (
                <SidebarItem
                  key={project.id}
                  href={`/p/${project.id}`}
                  tooltip={project.name}
                  badge={`${project.count}`}
                >
                  <FolderIcon />
                  <SidebarLabel>{project.name}</SidebarLabel>
                </SidebarItem>
              ))}
            </SidebarSection>
          )}
        </SidebarSectionGroup>

        {isAdmin && (
          <SidebarSectionGroup>
            <SidebarSection label="Admin">
              <SidebarItem
                href="/admin/users"
                tooltip="Manage Users"
                isCurrent={pathname === "/admin/users"}
              >
                <UsersIcon />
                <SidebarLabel>Users</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/admin/settings"
                tooltip="System Settings"
                isCurrent={pathname === "/admin/settings"}
              >
                <Cog8ToothIcon />
                <SidebarLabel>Settings</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/admin/audit"
                tooltip="Audit Logs"
                isCurrent={pathname === "/admin/audit"}
              >
                <ShieldCheckIcon />
                <SidebarLabel>Audit</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarSectionGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="flex flex-row justify-between gap-4 group-data-[state=collapsed]:justify-center">
        <SmoothDropdown isCollapsed={state === "collapsed"} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
