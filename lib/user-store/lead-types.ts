// lib/user-store/lead-types.ts
export type LeadSource = "linkedin" | "crunchbase" | "manual"

export type ValidationStatus = "pending" | "validated" | "rejected"

export interface Lead {
  id: string
  user_id: string | null
  type: "person" | "company"
  name: string
  title?: string | null
  company?: string | null
  industry?: string | null
  funding?: string | null
  location?: string | null
  source: LeadSource
  discoveredAt: string
  validationStatus: ValidationStatus
  rawData: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface LeadFilters {
  source?: LeadSource[]
  validationStatus?: ValidationStatus[]
  type?: "person" | "company"[]
  searchQuery?: string
  dateRange?: {
    from: string
    to: string
  }
}

export interface BulkLeadOperations {
  selectedLeads: string[]
  onSelect: (leadId: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onBulkExport: () => Promise<void>
  onBulkDelete: () => Promise<void>
  onBulkValidate: () => Promise<void>
  hasSelection: boolean
  allSelected: boolean
  someSelected: boolean
}
