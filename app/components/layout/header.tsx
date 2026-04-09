"use client"

import { HistoryTrigger } from "@/app/components/history/history-trigger"
import { AppInfoTrigger } from "@/app/components/layout/app-info/app-info-trigger"
import { ButtonNewChat } from "@/app/components/layout/button-new-chat"
import { UserMenu } from "@/app/components/layout/user-menu"
import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import MegaMenu from "@/components/ui/mega-menu"
import type { MegaMenuItem } from "@/components/ui/mega-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { APP_NAME } from "@/lib/config"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { useUser } from "@/lib/user-store/provider"
import { Info } from "@phosphor-icons/react"
import {
  BookOpen,
  Box,
  Cpu,
  Eye,
  FileText,
  Globe,
  Newspaper,
  Palette,
  Rocket,
  Search,
  Shield,
} from "lucide-react"
import Link from "next/link"
import { DialogPublish } from "./dialog-publish"

export function Header() {
  const isMobile = useBreakpoint(768)
  const { user } = useUser()
  const { preferences } = useUserPreferences()
  const isMultiModelEnabled = preferences.multiModelEnabled

  const isLoggedIn = !!user

  const NAV_ITEMS: MegaMenuItem[] = [
    {
      id: 1,
      label: "Products",
      subMenus: [
        {
          title: "DX Platform",
          items: [
            {
              label: "Multi-Model Chat",
              description: "Compare responses across models",
              icon: Cpu,
            },
            {
              label: "File Upload",
              description: "Analyze documents and images",
              icon: FileText,
            },
            {
              label: "BYOK Support",
              description: "Use your own API keys",
              icon: Shield,
            },
          ],
        },
        {
          title: "Managed Infrastructure",
          items: [
            {
              label: "Ollama Integration",
              description: "Run local models",
              icon: Box,
            },
            {
              label: "MCP Servers",
              description: "Extend with tools",
              icon: Globe,
            },
            {
              label: "Observability",
              description: "Monitor chat performance",
              icon: Eye,
            },
          ],
        },
      ],
    },
    {
      id: 2,
      label: "Solutions",
      subMenus: [
        {
          title: "Use Cases",
          items: [
            {
              label: "AI Apps",
              description: "Build intelligent applications",
              icon: Cpu,
            },
            {
              label: "Customer Support",
              description: "Automate support workflows",
              icon: Search,
            },
            {
              label: "Content Creation",
              description: "Generate and refine content",
              icon: Palette,
            },
            {
              label: "Code Assistance",
              description: "Accelerate development",
              icon: Rocket,
            },
          ],
        },
        {
          title: "Users",
          items: [
            {
              label: "Developers",
              description: "Build faster with AI",
              icon: Box,
            },
            {
              label: "Teams",
              description: "Collaborate on projects",
              icon: Globe,
            },
          ],
        },
      ],
    },
    {
      id: 3,
      label: "Resources",
      subMenus: [
        {
          title: "Documentation",
          items: [
            {
              label: "Getting Started",
              description: "Quick setup guide",
              icon: Rocket,
            },
            {
              label: "API Reference",
              description: "Detailed API docs",
              icon: BookOpen,
            },
            {
              label: "Guides",
              description: "Step-by-step tutorials",
              icon: Search,
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub",
              description: "View source code",
              icon: Box,
            },
            {
              label: "Blog",
              description: "Latest updates",
              icon: Newspaper,
            },
            {
              label: "Changelog",
              description: "See what shipped",
              icon: FileText,
            },
          ],
        },
      ],
    },
    { id: 4, label: "Enterprise", link: "#" },
    { id: 5, label: "Docs", link: "#" },
    { id: 6, label: "Pricing", link: "#" },
  ]

  return (
    <header className="h-app-header sticky top-0 z-[60]">
      <div className="relative mx-auto flex h-full max-w-full items-center justify-between bg-transparent px-4 sm:px-6 lg:bg-transparent lg:px-8">
        <div className="flex flex-1 items-center justify-between">
          <div className="-ml-0.5 flex flex-1 items-center gap-2 lg:-ml-2.5">
            <div className="flex flex-1 items-center gap-2">
              <SidebarTrigger className="hover:bg-muted bg-transparent" />
              {!isLoggedIn && !isMobile && (
                <MegaMenu items={NAV_ITEMS} className="hidden lg:flex" />
              )}
            </div>
          </div>
          <div />
          {!isLoggedIn ? (
            <div className="flex flex-1 items-center justify-end gap-4">
              <AppInfoTrigger
                trigger={
                  <button
                    className="bg-background hover:bg-muted text-muted-foreground h-8 w-8 rounded-full"
                    aria-label={`About ${APP_NAME}`}
                  >
                    <Info className="size-4" />
                  </button>
                }
              />
              <Link
                href="/auth"
                className="font-base text-muted-foreground hover:text-foreground text-base transition-colors"
              >
                Login
              </Link>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-end gap-2">
              {!isMultiModelEnabled && <DialogPublish />}
              <ButtonNewChat />
              <HistoryTrigger />
              <UserMenu />
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
