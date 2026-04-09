"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { FeedbackForm } from "@/components/common/feedback-form"
import {
  sendPasswordResetEmail,
  signInWithEmail,
  signInWithGithub,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/api"
import { APP_NAME } from "@/lib/config"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { useUser } from "@/lib/user-store/provider"
import { cn, isDev } from "@/lib/utils"
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import {
  CreditCardIcon,
  File01Icon,
  FolderIcon,
  HelpCircleIcon,
  LoaderPinwheelIcon,
  LockIcon,
  LoginIcon,
  LogoutIcon,
  MailAtSignIcon,
  SettingsIcon,
  ShieldUserIcon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CubeIcon,
  GearSixIcon,
  Info,
  KeyIcon,
  PaintBrushIcon,
  PlugsConnectedIcon,
  Question,
  User,
  XIcon,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import useMeasure from "react-use-measure"
import { Avatar } from "./avatar"
import { Button } from "./button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer"
import { Input } from "./input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

const easeOutQuint: [number, number, number, number] = [0.23, 1, 0.32, 1]

interface SmoothDropdownProps {
  isCollapsed?: boolean
}

type MenuItemId =
  | "settings"
  | "feedback"
  | "about"
  | "admin"
  | "divider"
  | "twitter"
  | "github"
  | "signout"
  | "signin"

interface MenuItem {
  id: MenuItemId
  label: string
  icon: typeof UserIcon
  href?: string
  external?: boolean
  adminOnly?: boolean
  danger?: boolean
}

const getMenuItems = (isLoggedIn: boolean, isAdmin: boolean): MenuItem[] => {
  if (!isLoggedIn) {
    return [{ id: "signin", label: "Sign In", icon: LoginIcon }]
  }

  return [
    { id: "settings", label: "Settings", icon: SettingsIcon },
    { id: "feedback", label: "Feedback", icon: HelpCircleIcon },
    { id: "about", label: "About", icon: File01Icon },
    ...(isAdmin
      ? [
          {
            id: "admin",
            label: "Admin Panel",
            icon: ShieldUserIcon,
          } as MenuItem,
        ]
      : []),
    { id: "divider", label: "", icon: File01Icon },
    {
      id: "twitter",
      label: "X / Twitter",
      icon: CreditCardIcon,
      href: "https://x.com/zoladotchat",
      external: true,
    },
    {
      id: "github",
      label: "GitHub",
      icon: FolderIcon,
      href: "https://github.com/ibelick/zola",
      external: true,
    },
    { id: "divider", label: "", icon: File01Icon },
    { id: "signout", label: "Sign Out", icon: LogoutIcon, danger: true },
  ]
}

function AvatarDisplay({
  src,
  initials,
  size,
  className,
}: {
  src?: string
  initials: string
  size?: "sm" | "md"
  className?: string
}) {
  if (src) {
    return <Avatar src={src} size={size || "sm"} className={className} />
  }
  return (
    <Avatar initials={initials} size={size || "sm"} className={className} />
  )
}

export function SmoothDropdown({ isCollapsed = false }: SmoothDropdownProps) {
  const { user, signOut } = useUser()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [contentRef, contentBounds] = useMeasure()

  const isAdmin = (user as any)?.role === "admin"
  const isLoggedIn = !!user && !user.anonymous
  const menuItems = getMenuItems(isLoggedIn, isAdmin)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const openHeight = Math.max(40, Math.ceil(contentBounds.height))

  const handleItemClick = async (item: MenuItem) => {
    if (item.external && item.href) {
      window.open(item.href, "_blank", "noopener,noreferrer")
      return
    }

    switch (item.id) {
      case "signin":
        router.push("/auth")
        break
      case "settings":
        setSettingsOpen(true)
        break
      case "feedback":
        setFeedbackOpen(true)
        break
      case "about":
        setAboutOpen(true)
        break
      case "admin":
        setAdminOpen(true)
        break
      case "signout":
        await signOut()
        break
    }
    setIsOpen(false)
  }

  const displayName = user?.display_name || user?.email || "Guest"
  const displayEmail = user?.email || ""

  if (isCollapsed) {
    return (
      <div className="relative">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="hover:bg-muted flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
        >
          {isLoggedIn ? (
            <AvatarDisplay
              src={user?.profile_image || undefined}
              initials={displayName.charAt(0).toUpperCase()}
              size="sm"
              className="size-5"
            />
          ) : (
            <HugeiconsIcon
              icon={UserIcon}
              className="text-muted-foreground h-5 w-5"
            />
          )}
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="bg-popover border-border absolute bottom-0 left-full ml-2 min-w-[200px] overflow-hidden rounded-lg border shadow-lg"
            >
              <div className="p-2">
                {isLoggedIn && (
                  <div className="mb-1 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <p className="text-foreground truncate text-sm font-medium">
                        {displayName}
                      </p>
                      {isAdmin && (
                        <span className="bg-primary/10 text-primary shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      {displayEmail}
                    </p>
                  </div>
                )}
                {!isLoggedIn && (
                  <div className="mb-1 px-3 py-2">
                    <p className="text-foreground text-sm font-medium">Guest</p>
                    <p className="text-muted-foreground text-xs">
                      Sign in for more features
                    </p>
                  </div>
                )}
                <ul className="m-0! flex list-none! flex-col gap-0.5 p-0!">
                  {menuItems.map((item, index) => {
                    if (item.id === "divider") {
                      return (
                        <motion.hr
                          key={`divider-${index}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.015 }}
                          className="border-border my-1.5!"
                        />
                      )
                    }

                    const iconRef = item.icon
                    const isDanger = item.danger
                    const showIndicator = hoveredItem === item.id
                    const itemDuration = item.id === "signout" ? 0.12 : 0.15
                    const itemDelay = 0.06 + index * 0.02

                    return (
                      <motion.li
                        key={item.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: itemDelay,
                          duration: itemDuration,
                          ease: easeOutQuint,
                        }}
                        onClick={() => handleItemClick(item)}
                        onMouseEnter={() => setHoveredItem(item.id)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className={`relative m-0! flex cursor-pointer items-center gap-3 rounded-lg py-2! pl-3! text-sm transition-colors duration-200 ease-out ${
                          isDanger && showIndicator
                            ? "text-red-600"
                            : showIndicator
                              ? "text-foreground"
                              : isDanger
                                ? "text-muted-foreground hover:text-red-600"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {showIndicator && (
                          <motion.div
                            layoutId={`activeIndicator-collapsed-${item.id}`}
                            className={`absolute inset-0 rounded-lg ${
                              isDanger ? "bg-red-50" : "bg-muted"
                            }`}
                            transition={{
                              type: "spring",
                              damping: 30,
                              stiffness: 520,
                              mass: 0.8,
                            }}
                          />
                        )}
                        {showIndicator && (
                          <motion.div
                            layoutId={`leftBar-collapsed-${item.id}`}
                            className={`absolute top-0 bottom-0 left-0 my-auto h-5 w-[3px] rounded-full ${
                              isDanger ? "bg-red-500" : "bg-foreground"
                            }`}
                            transition={{
                              type: "spring",
                              damping: 30,
                              stiffness: 520,
                              mass: 0.8,
                            }}
                          />
                        )}
                        <HugeiconsIcon
                          icon={iconRef}
                          className="relative z-10 h-[18px] w-[18px]"
                        />
                        <span className="relative z-10 font-medium">
                          {item.label}
                        </span>
                      </motion.li>
                    )
                  })}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
        <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
        <AdminDialog open={adminOpen} onOpenChange={setAdminOpen} />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="not-prose relative h-10 w-10">
      <motion.div
        layout
        initial={false}
        animate={{
          width: isOpen ? 220 : 40,
          height: isOpen ? openHeight : 40,
          borderRadius: isOpen ? 14 : 12,
        }}
        transition={{
          type: "spring" as const,
          damping: 34,
          stiffness: 380,
          mass: 0.8,
        }}
        className="bg-popover border-border absolute bottom-0 left-0 origin-bottom-left cursor-pointer overflow-hidden border shadow-lg"
        onClick={() => !isOpen && setIsOpen(true)}
      >
        <motion.div
          initial={false}
          animate={{
            opacity: isOpen ? 0 : 1,
            scale: isOpen ? 0.8 : 1,
          }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 flex items-center justify-center"
          style={{
            pointerEvents: isOpen ? "none" : "auto",
            willChange: "transform",
          }}
        >
          {isLoggedIn ? (
            <AvatarDisplay
              src={user?.profile_image || undefined}
              initials={displayName.charAt(0).toUpperCase()}
              size="sm"
              className="size-6"
            />
          ) : (
            <HugeiconsIcon
              icon={UserIcon}
              className="text-muted-foreground h-6 w-6"
            />
          )}
        </motion.div>

        <div ref={contentRef}>
          <motion.div
            layout
            initial={false}
            animate={{
              opacity: isOpen ? 1 : 0,
            }}
            transition={{
              duration: 0.2,
              delay: isOpen ? 0.08 : 0,
            }}
            className="p-2"
            style={{
              pointerEvents: isOpen ? "auto" : "none",
              willChange: "transform",
            }}
          >
            {isLoggedIn && (
              <div className="mb-1 px-3 py-2">
                <div className="flex items-center gap-2">
                  <p className="text-foreground truncate text-sm font-medium">
                    {displayName}
                  </p>
                  {isAdmin && (
                    <span className="bg-primary/10 text-primary shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  {displayEmail}
                </p>
              </div>
            )}
            {!isLoggedIn && (
              <div className="mb-1 px-3 py-2">
                <p className="text-foreground text-sm font-medium">Guest</p>
                <p className="text-muted-foreground text-xs">
                  Sign in for more features
                </p>
              </div>
            )}
            <ul className="m-0! flex list-none! flex-col gap-0.5 p-0!">
              {menuItems.map((item, index) => {
                if (item.id === "divider") {
                  return (
                    <motion.hr
                      key={`divider-${index}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isOpen ? 1 : 0 }}
                      transition={{ delay: isOpen ? 0.12 + index * 0.015 : 0 }}
                      className="border-border my-1.5!"
                    />
                  )
                }

                const iconRef = item.icon
                const isDanger = item.danger
                const showIndicator = hoveredItem === item.id
                const itemDuration = item.id === "signout" ? 0.12 : 0.15
                const itemDelay = isOpen ? 0.06 + index * 0.02 : 0

                return (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{
                      opacity: isOpen ? 1 : 0,
                      x: isOpen ? 0 : 8,
                    }}
                    transition={{
                      delay: itemDelay,
                      duration: itemDuration,
                      ease: easeOutQuint,
                    }}
                    onClick={() => handleItemClick(item)}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={`relative m-0! flex cursor-pointer items-center gap-3 rounded-lg py-2! pl-3! text-sm transition-colors duration-200 ease-out ${
                      isDanger && showIndicator
                        ? "text-red-600"
                        : showIndicator
                          ? "text-foreground"
                          : isDanger
                            ? "text-muted-foreground hover:text-red-600"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {showIndicator && (
                      <motion.div
                        layoutId={`activeIndicator-${item.id}`}
                        className={`absolute inset-0 rounded-lg ${
                          isDanger ? "bg-red-50" : "bg-muted"
                        }`}
                        transition={{
                          type: "spring",
                          damping: 30,
                          stiffness: 520,
                          mass: 0.8,
                        }}
                      />
                    )}
                    {showIndicator && (
                      <motion.div
                        layoutId={`leftBar-${item.id}`}
                        className={`absolute top-0 bottom-0 left-0 my-auto h-5 w-[3px] rounded-full ${
                          isDanger ? "bg-red-500" : "bg-foreground"
                        }`}
                        transition={{
                          type: "spring",
                          damping: 30,
                          stiffness: 520,
                          mass: 0.8,
                        }}
                      />
                    )}
                    <HugeiconsIcon
                      icon={iconRef}
                      className="relative z-10 h-[18px] w-[18px]"
                    />
                    <span className="relative z-10 font-medium">
                      {item.label}
                    </span>
                  </motion.li>
                )
              })}
            </ul>
          </motion.div>
        </div>
      </motion.div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <AdminDialog open={adminOpen} onOpenChange={setAdminOpen} />
    </div>
  )
}

// Settings Dialog wrapper
function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isMobile = useBreakpoint(768)
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen)
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="bg-background border-border">
          <div className="bg-background border-border mb-2 flex items-center justify-between border-b px-4 pb-2">
            <h2 className="text-lg font-medium">Settings</h2>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <XIcon className="size-4" />
              </Button>
            </DrawerClose>
          </div>
          <SettingsContentInner isDrawer />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[80%] min-h-[480px] w-full flex-col gap-0 p-0 sm:max-w-[768px]">
        <DialogHeader className="border-border border-b px-6 py-5">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <SettingsContentInner />
      </DialogContent>
    </Dialog>
  )
}

type TabType = "general" | "appearance" | "models" | "connections"

function SettingsContentInner({ isDrawer = false }: { isDrawer?: boolean }) {
  const [activeTab, setActiveTab] = useState<TabType>("general")

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-y-auto",
        isDrawer ? "p-0 pb-16" : "py-0"
      )}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabType)}
        className={cn("flex h-full w-full flex-col", isDrawer ? "" : "pt-4")}
      >
        <div className="px-6">
          <TabsList>
            <TabsTrigger value="general">
              <GearSixIcon className="size-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <PaintBrushIcon className="size-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="models">
              <CubeIcon className="size-4" />
              Models
            </TabsTrigger>
            <TabsTrigger value="connections">
              <PlugsConnectedIcon className="size-4" />
              Connections
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent
            value="general"
            className="px-6 py-4 data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:gap-6"
          >
            <SettingsUserProfile />
            {isSupabaseEnabled() && <SettingsAccountManagement />}
          </TabsContent>

          <TabsContent
            value="appearance"
            className="px-6 py-4 data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:gap-6"
          >
            <ThemeSelection />
            <LayoutSettings />
            <InteractionPreferences />
          </TabsContent>

          <TabsContent
            value="models"
            className="px-6 py-4 data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:gap-6"
          >
            <ModelsSettingsInner />
          </TabsContent>

          <TabsContent
            value="connections"
            className="px-6 py-4 data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:gap-6"
          >
            {isDev ? (
              <>
                <OllamaSectionInner />
                <DeveloperToolsInner />
              </>
            ) : (
              <ConnectionsPlaceholderInner />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function SettingsUserProfile() {
  const {
    UserProfile,
  } = require("@/app/components/layout/settings/general/user-profile")
  return <UserProfile />
}

function SettingsAccountManagement() {
  const {
    AccountManagement,
  } = require("@/app/components/layout/settings/general/account-management")
  return <AccountManagement />
}

function ThemeSelection() {
  const {
    ThemeSelection,
  } = require("@/app/components/layout/settings/appearance/theme-selection")
  return <ThemeSelection />
}

function LayoutSettings() {
  const {
    LayoutSettings,
  } = require("@/app/components/layout/settings/appearance/layout-settings")
  return <LayoutSettings />
}

function InteractionPreferences() {
  const {
    InteractionPreferences,
  } = require("@/app/components/layout/settings/appearance/interaction-preferences")
  return <InteractionPreferences />
}

function ModelsSettingsInner() {
  const {
    ModelsSettings,
  } = require("@/app/components/layout/settings/models/models-settings")
  return <ModelsSettings />
}

function OllamaSectionInner() {
  const {
    OllamaSection,
  } = require("@/app/components/layout/settings/connections/ollama-section")
  return <OllamaSection />
}

function DeveloperToolsInner() {
  const {
    DeveloperTools,
  } = require("@/app/components/layout/settings/connections/developer-tools")
  return <DeveloperTools />
}

function ConnectionsPlaceholderInner() {
  const {
    ConnectionsPlaceholder,
  } = require("@/app/components/layout/settings/connections/connections-placeholder")
  return <ConnectionsPlaceholder />
}

// Feedback Dialog wrapper
function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useUser()
  const isMobile = useBreakpoint(768)

  if (!isSupabaseEnabled()) return null

  const handleClose = () => {
    onOpenChange(false)
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-background border-border">
          <FeedbackForm authUserId={user?.id} onClose={handleClose} />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[&>button:last-child]:bg-background overflow-hidden p-0 shadow-xs sm:max-w-md [&>button:last-child]:top-3.5 [&>button:last-child]:right-3 [&>button:last-child]:rounded-full [&>button:last-child]:p-1">
        <FeedbackForm authUserId={user?.id} onClose={handleClose} />
      </DialogContent>
    </Dialog>
  )
}

// About Dialog wrapper
function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isMobile = useBreakpoint(768)

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-background border-border">
          <DrawerHeader>
            <Image
              src="/banner_ocean.jpg"
              alt={`calm paint generate by ${APP_NAME}`}
              width={400}
              height={128}
              className="h-32 w-full object-cover"
            />
            <DrawerTitle className="hidden">{APP_NAME}</DrawerTitle>
            <DrawerDescription className="hidden">
              Your minimalist AI chat companion
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <AppInfoContentInner />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[&>button:last-child]:bg-background gap-0 overflow-hidden rounded-3xl p-0 shadow-xs sm:max-w-md [&>button:last-child]:rounded-full [&>button:last-child]:p-1">
        <DialogHeader className="p-0">
          <Image
            src="/banner_ocean.jpg"
            alt={`calm paint generate by ${APP_NAME}`}
            width={400}
            height={128}
            className="h-32 w-full object-cover"
          />
          <DialogTitle className="hidden">{APP_NAME}</DialogTitle>
          <DialogDescription className="hidden">
            Your minimalist AI chat companion
          </DialogDescription>
        </DialogHeader>
        <div className="p-4">
          <AppInfoContentInner />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AppInfoContentInner() {
  const {
    AppInfoContent,
  } = require("@/app/components/layout/app-info/app-info-content")
  return <AppInfoContent />
}

// Admin Panel Dialog
function AdminDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [users, setUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
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
    fetchUsers()
  }, [open])

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Admin Panel</DialogTitle>
          <DialogDescription>
            Manage user roles and system settings.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <HugeiconsIcon
              icon={LoaderPinwheelIcon}
              className="text-muted-foreground size-5 animate-spin"
            />
          </div>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {users.map((u) => (
              <div
                key={u.id}
                className="border-border flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    {u.display_name || "No name"}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {u.email}
                  </p>
                </div>
                <div className="ml-3 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
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
                    Toggle
                  </button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No users found.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
