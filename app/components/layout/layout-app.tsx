"use client"

import { Header } from "@/app/components/layout/header"
import AppSidebar from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"

export function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar collapsible="dock" intent="inset" />
      <SidebarInset>
        <Header />
        <main className="@container relative flex-1 overflow-hidden">
          {children}
        </main>
      </SidebarInset>
    </>
  )
}
