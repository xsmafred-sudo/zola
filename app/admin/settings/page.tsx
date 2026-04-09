import { Cog8ToothIcon } from "@heroicons/react/24/solid"

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-border border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Cog8ToothIcon className="size-5" />
          <h1 className="text-xl font-semibold">System Settings</h1>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure system-wide settings and preferences
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-muted-foreground py-8 text-center text-sm">
          System settings coming soon.
        </div>
      </div>
    </div>
  )
}
