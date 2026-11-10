/**
 * Centralized React Query Keys Factory for tan-pms.
 * Ensures strict cache invalidation harmony across all admin and client features.
 */
export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    session: () => [...queryKeys.auth.all, "session"] as const,
  },
  roles: {
    all: ["admin-roles"] as const,
    list: () => [...queryKeys.roles.all, "list"] as const,
  },
  users: {
    all: ["admin-users"] as const,
    list: () => [...queryKeys.users.all, "list"] as const,
    detail: (id: string) => [...queryKeys.users.all, "detail", id] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    admin: (propertyId?: string) =>
      [...queryKeys.notifications.all, "admin", propertyId ?? "all"] as const,
    client: (customerId?: string) =>
      [...queryKeys.notifications.all, "client", customerId ?? "all"] as const,
  },
  properties: {
    all: ["admin-property-hierarchy"] as const,
    hierarchy: (propertyId: string) =>
      [...queryKeys.properties.all, propertyId] as const,
    unitDetail: (unitId: string) =>
      ["admin-unit-detail", unitId] as const,
  },
  rates: {
    all: ["admin-rates"] as const,
    catalog: (propertyId: string) =>
      [...queryKeys.rates.all, propertyId] as const,
    detail: (planId: string) =>
      ["admin-rate-plan-detail", planId] as const,
  },
  availability: {
    all: ["admin-availability"] as const,
    search: (propertyId: string, params?: Record<string, unknown>) =>
      [...queryKeys.availability.all, propertyId, params] as const,
  },
  reservations: {
    all: ["admin-reservations"] as const,
    list: (propertyId: string, status?: string, stayMode?: string) =>
      [...queryKeys.reservations.all, propertyId, status ?? "", stayMode ?? ""] as const,
    detail: (id: string) =>
      ["admin-reservation-detail", id] as const,
  },
  rack: {
    all: ["admin-rack"] as const,
    byProperty: (propertyId: string) =>
      [...queryKeys.rack.all, propertyId] as const,
  },
  stays: {
    all: ["admin-stays"] as const,
    list: (propertyId: string, status?: string, stayMode?: string) =>
      [...queryKeys.stays.all, propertyId, status ?? "", stayMode ?? ""] as const,
    detail: (id: string) =>
      ["admin-stay-detail", id] as const,
  },
  leases: {
    all: ["admin-leases"] as const,
    list: (propertyId: string, status?: string, licensePlate?: string) =>
      [...queryKeys.leases.all, propertyId, status ?? "", licensePlate ?? ""] as const,
    detail: (propertyId: string, leaseId: string) =>
      [...queryKeys.leases.all, "detail", propertyId, leaseId] as const,
  },
  meters: {
    all: ["admin-meters"] as const,
    sheet: (propertyId: string, period: string, buildingId?: string) =>
      [...queryKeys.meters.all, propertyId, period, buildingId ?? ""] as const,
  },
  billing: {
    all: ["admin-billing"] as const,
    invoices: (propertyId: string, period?: string, status?: string) =>
      [...queryKeys.billing.all, "invoices", propertyId, period ?? "", status ?? ""] as const,
    invoice: (propertyId: string, id: string) =>
      [...queryKeys.billing.all, "invoice", propertyId, id] as const,
  },
  cashier: {
    all: ["admin-cashier"] as const,
    current: (propertyId: string) => [...queryKeys.cashier.all, "current", propertyId] as const,
    shifts: (propertyId: string, status?: string) =>
      [...queryKeys.cashier.all, "shifts", propertyId, status ?? ""] as const,
    shift: (propertyId: string, id: string) => [...queryKeys.cashier.all, "shift", propertyId, id] as const,
  },
  payments: {
    all: ["admin-payments"] as const,
    slips: (propertyId: string, status?: string) =>
      [...queryKeys.payments.all, "slips", propertyId, status ?? ""] as const,
    slip: (propertyId: string, id: string) => [...queryKeys.payments.all, "slip", propertyId, id] as const,
  },
  depositLedgers: {
    all: ["admin-deposit-ledgers"] as const,
    list: (propertyId: string, type?: string) =>
      [...queryKeys.depositLedgers.all, propertyId, type ?? ""] as const,
    detail: (propertyId: string, id: string) =>
      [...queryKeys.depositLedgers.all, "detail", propertyId, id] as const,
  },
  housekeeping: {
    all: ["admin-housekeeping"] as const,
    list: (propertyId: string, status?: string, buildingId?: string) =>
      [...queryKeys.housekeeping.all, propertyId, status ?? "", buildingId ?? ""] as const,
  },
  workOrders: {
    all: ["admin-work-orders"] as const,
    list: (propertyId: string, status?: string) =>
      [...queryKeys.workOrders.all, "list", propertyId, status ?? ""] as const,
    detail: (propertyId: string, id: string) =>
      [...queryKeys.workOrders.all, "detail", propertyId, id] as const,
  },
  parcels: {
    all: ["admin-parcels"] as const,
    list: (propertyId: string, status?: string) =>
      [...queryKeys.parcels.all, "list", propertyId, status ?? ""] as const,
    detail: (propertyId: string, id: string) =>
      [...queryKeys.parcels.all, "detail", propertyId, id] as const,
  },
  customers: {
    all: ["admin-customers"] as const,
    search: (propertyId: string, search: string) =>
      [...queryKeys.customers.all, propertyId, search] as const,
  },
  regulatoryExports: {
    all: ["admin-regulatory"] as const,
    export: (propertyId: string, date?: string) =>
      [...queryKeys.regulatoryExports.all, propertyId, date ?? ""] as const,
  },
  clientPortal: {
    all: ["client-portal"] as const,
    leases: () => [...queryKeys.clientPortal.all, "leases"] as const,
    lease: (id: string) => [...queryKeys.clientPortal.all, "lease", id] as const,
    leaseIntents: () => [...queryKeys.clientPortal.all, "lease-intents"] as const,
    invoices: (status?: string) => [...queryKeys.clientPortal.all, "invoices", status ?? ""] as const,
    invoice: (id: string) => [...queryKeys.clientPortal.all, "invoice", id] as const,
    slips: () => [...queryKeys.clientPortal.all, "slips"] as const,
    usage: (leaseId?: string, months?: number) =>
      [...queryKeys.clientPortal.all, "usage", leaseId ?? "", months ?? 0] as const,
    workOrders: (status?: string) => [...queryKeys.clientPortal.all, "work-orders", status ?? ""] as const,
    workOrder: (id: string) => [...queryKeys.clientPortal.all, "work-order", id] as const,
    parcels: (status?: string) => [...queryKeys.clientPortal.all, "parcels", status ?? ""] as const,
    reservations: () => [...queryKeys.clientPortal.all, "reservations"] as const,
    reservation: (id: string) => [...queryKeys.clientPortal.all, "reservation", id] as const,
    availability: (params: object) => [...queryKeys.clientPortal.all, "availability", params] as const,
    notifications: () => [...queryKeys.clientPortal.all, "notifications"] as const,
  },
  leaseIntents: {
    all: ["admin-lease-intents"] as const,
    list: (propertyId: string, status?: string) =>
      [...queryKeys.leaseIntents.all, propertyId, status ?? ""] as const,
  },
  analytics: {
    all: ["admin-analytics"] as const,
    report: (propertyId: string, report: string, from: string, to: string) =>
      [...queryKeys.analytics.all, propertyId, report, from, to] as const,
  },
  clientDashboard: {
    all: ["client-dashboard"] as const,
    summary: (customerId?: string) =>
      [...queryKeys.clientDashboard.all, customerId ?? "current"] as const,
  },
} as const;
