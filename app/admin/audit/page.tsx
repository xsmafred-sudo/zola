import { ShieldCheckIcon } from "@heroicons/react/24/solid"

export default function AdminAuditPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-border border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <ShieldCheckIcon className="size-5" />
          <h1 className="text-xl font-semibold">Audit Logs</h1>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          View system activity and audit trails
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-muted-foreground py-8 text-center text-sm">
          Audit logs coming soon.
        </div>
      </div>
    </div>
  )
}
