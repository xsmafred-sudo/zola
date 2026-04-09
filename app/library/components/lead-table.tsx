// app/library/components/lead-table.tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Lead } from "@/lib/user-store/lead-types"
import { useState } from "react"

interface LeadTableProps {
  leads: Lead[]
  onLeadSelect: (leadId: string, selected: boolean) => void
  selectedLeads: string[]
}

export function LeadTable({
  leads,
  onLeadSelect,
  selectedLeads,
}: LeadTableProps) {
  const [sortField, setSortField] = useState<string>("discoveredAt")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const sortedLeads = [...leads].sort((a, b) => {
    const aVal = a[sortField as keyof Lead] ?? ""
    const bVal = b[sortField as keyof Lead] ?? ""

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
    return 0
  })

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <Checkbox
                  checked={
                    selectedLeads.length === leads.length && leads.length > 0
                  }
                  onCheckedChange={(checked) =>
                    onLeadSelect("", checked === true)
                  }
                />
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase hover:bg-gray-100"
                onClick={() => handleSort("name")}
              >
                Name
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase hover:bg-gray-100"
                onClick={() => handleSort("company")}
              >
                Company
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase hover:bg-gray-100"
                onClick={() => handleSort("title")}
              >
                Title
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase hover:bg-gray-100"
                onClick={() => handleSort("source")}
              >
                Source
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase hover:bg-gray-100"
                onClick={() => handleSort("validationStatus")}
              >
                Status
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase hover:bg-gray-100"
                onClick={() => handleSort("discoveredAt")}
              >
                Discovered
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sortedLeads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={(checked) =>
                      onLeadSelect(lead.id, checked === true)
                    }
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {lead.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {lead.company}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {lead.title}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  <Badge variant="outline">{lead.source}</Badge>
                </td>
                <td className="px-4 py-3 text-sm">
                  <Badge
                    variant={
                      lead.validationStatus === "validated"
                        ? "default"
                        : lead.validationStatus === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {lead.validationStatus}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(lead.discoveredAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {sortedLeads.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No leads found. Use discovery agents to find leads.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
