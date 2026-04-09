"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"

export default function AppSidebarNav() {
  return (
    <div className="flex items-center gap-x-4 px-4 py-2">
      <SidebarTrigger className="-ml-2.5 lg:ml-0" />
    </div>
  )
}
