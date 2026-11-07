"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CommandTag } from "@/components/ui/command-tag";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Textarea } from "@/components/ui/textarea";
import { EntityAutocomplete } from "@/components/ui/entity-autocomplete";
import { useDataTableState } from "@/hooks/use-data-table-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { BarChart3, Check, Plus, UserCheck, XCircle } from "lucide-react";
import { formatCurrencyThb } from "@/lib/formatters";
import { KpiSummaryStrip, type KpiItem } from "@/components/layout/kpi-summary-strip";
import { ListToolbar } from "@/components/layout/list-toolbar";
import { BulkActionToolbar } from "@/components/layout/bulk-action-toolbar";
import {
  INITIAL_RESERVATIONS,
  INITIAL_AVAILABILITY_ITEMS,
  SAMPLE_PROPERTY,
  SAMPLE_CUSTOMERS,
  SAMPLE_UNIT_TYPES,
  SAMPLE_ASSIGNABLE_UNITS,
  CUSTOMER_MAP,
  RESERVATION_UNIT_TYPE_MAP,
  ALL_ASSIGNABLE_UNITS_MAP,
} from "../constants";
import type {
  ReservationItemDto,
  UnitTypeAvailabilityDto,
  AssignableUnitOptionDto,
  ReservationStatusType,
  ReservationStayModeType,
  UnitRefDto,
} from "../types";

export interface AdminReservationsSectionProps {
  initialReservations?: ReservationItemDto[];
  initialAvailability?: UnitTypeAvailabilityDto[];
}

export function AdminReservationsSection({
  initialReservations = INITIAL_RESERVATIONS,
  initialAvailability = INITIAL_AVAILABILITY_ITEMS,
}: AdminReservationsSectionProps) {
  const locale = useLocale() as "th" | "en";
  const tRes = useTranslations("admin.reservations");
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");

  // In-memory data states
  const [reservations, setReservations] =
    useState<ReservationItemDto[]>(initialReservations);
  const [availabilityItems] =
    useState<UnitTypeAvailabilityDto[]>(initialAvailability);

  // Filters & Table State
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    selectedIds: selectedRowIds,
    setSelectedIds: setSelectedRowIds,
  } = useDataTableState<{ status: string; stayMode: string }>({
    initialFilters: { status: "All", stayMode: "All" },
    debounceMs: 0,
  });
  const statusFilter = filters.status;
  const setStatusFilter = (v: string) => setFilter("status", v);
  const stayModeFilter = filters.stayMode;
  const setStayModeFilter = (v: string) => setFilter("stayMode", v);

  // Modals visibility
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Target reservation for actions
  const [selectedResId, setSelectedResId] = useState<string | null>(null);

  // Confirmations
  const [isConfirmCreateOpen, setIsConfirmCreateOpen] = useState(false);
  const [isConfirmAssignOpen, setIsConfirmAssignOpen] = useState(false);
  const [isConfirmApproveOpen, setIsConfirmApproveOpen] = useState(false);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create Form State
  const [formStayMode, setFormStayMode] =
    useState<ReservationStayModeType>("Daily");
  const [formSlotStart, setFormSlotStart] = useState("2026-11-15T14:00");
  const [formSlotEnd, setFormSlotEnd] = useState("2026-11-17T12:00");
  const [formUnitTypeId, setFormUnitTypeId] = useState(SAMPLE_UNIT_TYPES[0].id);
  const [formAllocationType, setFormAllocationType] = useState<
    "quota" | "specific"
  >("quota");
  const [formSpecificUnitId, setFormSpecificUnitId] = useState("");
  const [formCustomerId, setFormCustomerId] = useState(SAMPLE_CUSTOMERS[0].id);
  const [formDepositAmount, setFormDepositAmount] = useState(1000);
  const [formConfirmImmediately, setFormConfirmImmediately] = useState(true);
  const [createActiveTab, setCreateActiveTab] = useState("tab-slot-unit");

  // Assign Unit Form State
  const [selectedUnitForAssign, setSelectedUnitForAssign] = useState("");

  // Cancel / NoShow Form State
  const [cancelType, setCancelType] = useState<"cancel" | "no-show">("cancel");
  const [cancelReason, setCancelReason] = useState("");

  // Customer options for EntityAutocomplete
  const customerOptions = useMemo(
    () =>
      SAMPLE_CUSTOMERS.map((c) => ({
        value: c.id,
        label: `${c.fullName} (${c.maskedNationalId})`,
      })),
    []
  );

  // Memoized reservation lookup map (Zero .find() in UI components)
  const reservationsMap = useMemo(
    () => Object.fromEntries(reservations.map((r) => [r.id, r])),
    [reservations]
  );

  // Active target reservation
  const targetReservation = useMemo(() => {
    return selectedResId ? reservationsMap[selectedResId] ?? null : null;
  }, [reservationsMap, selectedResId]);

  // Clean units available for assignment to target reservation
  const availableCleanUnits = useMemo(() => {
    if (!targetReservation) return [];
    const units = SAMPLE_ASSIGNABLE_UNITS[targetReservation.unitType.id] || [];
    return units.filter((u) => u.conditionStatus === "Clean");
  }, [targetReservation]);

  // Filtered reservations
  const filteredReservations = useMemo(() => {
    return reservations.filter((res) => {
      const matchesStatus =
        statusFilter === "All" || res.status === statusFilter;
      const matchesStayMode =
        stayModeFilter === "All" || res.stayMode === stayModeFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        res.documentNumber.toLowerCase().includes(q) ||
        res.customer.fullName.toLowerCase().includes(q) ||
        res.unitType.code.toLowerCase().includes(q);
      return matchesStatus && matchesStayMode && matchesQuery;
    });
  }, [reservations, statusFilter, stayModeFilter, searchQuery]);

  // KPI Counts
  const kpiTotal = reservations.length;
  const kpiHold = reservations.filter((r) => r.status === "Hold").length;
  const kpiPending = reservations.filter(
    (r) => r.status === "PendingVerification"
  ).length;
  const kpiUnassigned = reservations.filter((r) => !r.assignedUnit).length;

  const kpiItems: KpiItem[] = [
    {
      id: "total",
      label: tRes("filterStatusAll"),
      value: kpiTotal,
    },
    {
      id: "hold",
      label: tRes("statusHold"),
      value: kpiHold,
    },
    {
      id: "pending",
      label: tRes("statusPendingVerification"),
      value: kpiPending,
    },
    {
      id: "unassigned",
      label: tRes("badgeUnassigned", { count: "" }).replace(":", "").trim() || "Unassigned",
      value: kpiUnassigned,
      isAlert: kpiUnassigned > 0,
    },
  ];

  // Handlers
  const handleOpenAssign = (res: ReservationItemDto) => {
    setSelectedResId(res.id);
    const cleanUnits = SAMPLE_ASSIGNABLE_UNITS[res.unitType.id] || [];
    const cleanOnly = cleanUnits.filter((u) => u.conditionStatus === "Clean");
    const firstClean = cleanOnly[0] ?? null;
    setSelectedUnitForAssign(firstClean?.id || "");
    setIsAssignModalOpen(true);
  };

  const handleOpenConfirmApprove = (res: ReservationItemDto) => {
    setSelectedResId(res.id);
    setIsConfirmApproveOpen(true);
  };

  const handleApproveReservation = async () => {
    if (!selectedResId) return;
    setIsSubmitting(true);
    try {
      setReservations((prev) =>
        prev.map((r) =>
          r.id === selectedResId
            ? {
                ...r,
                status: "Confirmed",
              }
            : r
        )
      );
      setIsConfirmApproveOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCancel = (res: ReservationItemDto) => {
    setSelectedResId(res.id);
    setCancelType("cancel");
    setCancelReason("");
    setIsCancelModalOpen(true);
  };

  const handleTriggerCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;
    setIsConfirmCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedResId) return;
    setIsSubmitting(true);
    try {
      setReservations((prev) =>
        prev.map((r) =>
          r.id === selectedResId
            ? {
                ...r,
                status: cancelType === "cancel" ? "Cancelled" : "NoShow",
                cancellationReason: cancelReason.trim(),
              }
            : r
        )
      );
      setIsConfirmCancelOpen(false);
      setIsCancelModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitForAssign) return;
    setIsConfirmAssignOpen(true);
  };

  const handleConfirmAssignUnit = async () => {
    if (!selectedResId || !targetReservation) return;
    setIsSubmitting(true);
    try {
      const assigned = ALL_ASSIGNABLE_UNITS_MAP[selectedUnitForAssign];
      if (assigned) {
        setReservations((prev) =>
          prev.map((r) =>
            r.id === selectedResId
              ? {
                  ...r,
                  assignedUnit: {
                    id: assigned.id,
                    unitNumber: assigned.unitNumber,
                    buildingName: { ...assigned.buildingName },
                    floorNumber: assigned.floorNumber,
                    unitTypeName: { ...targetReservation.unitType.name },
                  },
                }
              : r
          )
        );
      }
      setIsConfirmAssignOpen(false);
      setIsAssignModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCreateModal = () => {
    setFormStayMode("Daily");
    setFormSlotStart("2026-11-15T14:00");
    setFormSlotEnd("2026-11-17T12:00");
    setFormUnitTypeId(SAMPLE_UNIT_TYPES[0].id);
    setFormAllocationType("quota");
    setFormSpecificUnitId("");
    setFormCustomerId(SAMPLE_CUSTOMERS[0].id);
    setFormDepositAmount(1000);
    setFormConfirmImmediately(true);
    setCreateActiveTab("tab-slot-unit");
    setIsCreateModalOpen(true);
  };

  const handleTriggerCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsConfirmCreateOpen(true);
  };

  const handleConfirmCreateReservation = async () => {
    setIsSubmitting(true);
    try {
      const selectedCustomer =
        CUSTOMER_MAP[formCustomerId] ?? SAMPLE_CUSTOMERS[0];
      const selectedUnitType =
        RESERVATION_UNIT_TYPE_MAP[formUnitTypeId] ?? SAMPLE_UNIT_TYPES[0];

      let assignedUnitObj: UnitRefDto | undefined = undefined;
      if (formAllocationType === "specific" && formSpecificUnitId) {
        const found = ALL_ASSIGNABLE_UNITS_MAP[formSpecificUnitId];
        if (found) {
          assignedUnitObj = {
            id: found.id,
            unitNumber: found.unitNumber,
            buildingName: { ...found.buildingName },
            floorNumber: found.floorNumber,
            unitTypeName: { ...selectedUnitType.name },
          };
        }
      }

      const seqNumber = String(reservations.length + 1).padStart(4, "0");
      const newDocNumber = `BKK01-RES-2611-${seqNumber}`;

      const newReservation: ReservationItemDto = {
        id: `res-${Date.now()}`,
        documentNumber: newDocNumber,
        property: SAMPLE_PROPERTY,
        customer: selectedCustomer,
        unitType: selectedUnitType,
        assignedUnit: assignedUnitObj,
        stayMode: formStayMode,
        slotStartAt: `${formSlotStart}:00Z`,
        slotEndAt: `${formSlotEnd}:00Z`,
        effectiveBlockedEndAt: `${formSlotEnd}:00Z`,
        holdExpiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
        depositAmount: Number(formDepositAmount) || 0,
        status: formConfirmImmediately ? "Confirmed" : "Hold",
      };

      setReservations((prev) => [newReservation, ...prev]);
      setIsConfirmCreateOpen(false);
      setIsCreateModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Columns definition (Table-Preserved)
  const columns: ColumnDef<ReservationItemDto>[] = [
    {
      id: "document",
      header: tRes("colDocument"),
      sortable: true,
      sortValue: (row) => row.documentNumber,
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <CommandTag prefixCode="RES">{row.documentNumber}</CommandTag>
        </div>
      ),
    },
    {
      id: "customer",
      header: tRes("colCustomer"),
      sortable: true,
      sortValue: (row) => row.customer.fullName,
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-xs text-ink">
            {row.customer.fullName}
          </span>
          <span className="font-mono text-[11px] text-mute">
            {row.customer.maskedNationalId}
          </span>
        </div>
      ),
    },
    {
      id: "stayModeSlot",
      header: tRes("colStayModeSlot"),
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="rounded-full font-mono text-[10px] px-1.5 py-0.2 bg-surface-soft"
            >
              {tModes(row.stayMode)}
            </Badge>
            {row.stayMode === "Hourly" && (
              <span className="text-[10px] font-mono text-mute">
                +30m Turnaround
              </span>
            )}
          </div>
          <span className="font-mono text-[11px] text-body tabular-nums">
            {row.slotStartAt.slice(0, 16).replace("T", " ")} →{" "}
            {row.slotEndAt.slice(0, 16).replace("T", " ")}
          </span>
        </div>
      ),
    },
    {
      id: "unitTypeUnit",
      header: tRes("colUnitTypeUnit"),
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-ink font-medium">
            {resolveLocalizedText(row.unitType.name, locale)} ({row.unitType.code})
          </span>
          {row.assignedUnit ? (
            <span className="font-mono text-xs font-semibold text-primary">
              Unit {row.assignedUnit.unitNumber}
            </span>
          ) : (
            <Badge
              variant="outline"
              className="w-fit rounded-full text-[10px] text-mute border-dashed"
            >
              {tRes("quotaUnassignedBadge")}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "statusDeposit",
      header: tRes("colStatusDeposit"),
      sortable: true,
      sortValue: (row) => row.depositAmount,
      align: "right",
      cell: (row) => {
        let statusBadgeVariant: "default" | "outline" | "secondary" = "outline";
        if (row.status === "Confirmed") statusBadgeVariant = "default";

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Badge
                variant={statusBadgeVariant}
                className="rounded-full text-[10px] font-mono px-2 py-0.5"
              >
                {row.status}
              </Badge>
              {row.paymentSlipFileKey && (
                <Badge
                  variant="outline"
                  className="rounded-full text-[9px] px-1.5 py-0.2 bg-surface-soft"
                >
                  {tRes("slipAttachedBadge")}
                </Badge>
              )}
            </div>
            <span className="font-mono text-xs text-body tabular-nums">
              Dep: {formatCurrencyThb(row.depositAmount)}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: <span className="sr-only">{tRes("colActions")}</span>,
      headerClassName: "w-[120px] text-right",
      className: "text-right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {!row.assignedUnit && row.status !== "Cancelled" && (
            <Tooltip content={tRes("actionAssignUnit")} position="top">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleOpenAssign(row)}
                aria-label={tRes("actionAssignUnit")}
                className="rounded-full h-7 w-7 text-xs text-ink hover:bg-surface-soft"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span className="sr-only">{tRes("actionAssignUnit")}</span>
              </Button>
            </Tooltip>
          )}

          {(row.status === "Hold" || row.status === "PendingVerification") && (
            <Tooltip content={tRes("actionConfirm")} position="top">
              <Button
                type="button"
                size="icon"
                onClick={() => handleOpenConfirmApprove(row)}
                aria-label={tRes("actionConfirm")}
                className="rounded-full h-7 w-7 text-xs bg-ink text-canvas hover:bg-neutral-800"
              >
                <Check className="h-3.5 w-3.5" />
                <span className="sr-only">{tRes("actionConfirm")}</span>
              </Button>
            </Tooltip>
          )}

          {row.status !== "Cancelled" && row.status !== "NoShow" && (
            <Tooltip content={tRes("actionCancel")} position="top">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleOpenCancel(row)}
                aria-label={tRes("actionCancel")}
                className="rounded-full h-7 w-7 text-xs text-destructive hover:bg-destructive/10"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span className="sr-only">{tRes("actionCancel")}</span>
              </Button>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  // Admin Create Form Tabs
  const createFormTabs: FormTabItem[] = [
    {
      id: "tab-slot-unit",
      label: tRes("tabSlotAndUnit"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-ink">
              {tRes("fieldStayMode")}
            </Label>
            <div className="flex items-center gap-2">
              {(["Hourly", "Daily", "Monthly"] as ReservationStayModeType[]).map(
                (mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={formStayMode === mode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormStayMode(mode)}
                    className="rounded-full text-xs font-mono h-8 px-4"
                  >
                    {tModes(mode)}
                  </Button>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRes("fieldSlotStart")}
              </Label>
              <Input
                type="text"
                value={formSlotStart}
                onChange={(e) => setFormSlotStart(e.target.value)}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRes("fieldSlotEnd")}
              </Label>
              <Input
                type="text"
                value={formSlotEnd}
                onChange={(e) => setFormSlotEnd(e.target.value)}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-ink">
              {tRes("fieldUnitType")}
            </Label>
            <SelectPill
              value={formUnitTypeId}
              onChange={(e) => {
                setFormUnitTypeId(e.target.value);
                setFormSpecificUnitId("");
              }}
              className="h-10 text-xs"
            >
              {SAMPLE_UNIT_TYPES.map((ut) => (
                <option key={ut.id} value={ut.id}>
                  {ut.code} — {resolveLocalizedText(ut.name, locale)} ({ut.areaSqm} m²)
                </option>
              ))}
            </SelectPill>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-ink">
              {tRes("fieldAllocationType")}
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={formAllocationType === "quota" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormAllocationType("quota")}
                className="rounded-full text-xs h-8 px-4"
              >
                {tRes("allocationQuota")}
              </Button>
              <Button
                type="button"
                variant={
                  formAllocationType === "specific" ? "default" : "outline"
                }
                size="sm"
                onClick={() => setFormAllocationType("specific")}
                className="rounded-full text-xs h-8 px-4"
              >
                {tRes("allocationSpecific")}
              </Button>
            </div>
          </div>

          {formAllocationType === "specific" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRes("fieldSpecificUnit")}
              </Label>
              <SelectPill
                value={formSpecificUnitId}
                onChange={(e) => setFormSpecificUnitId(e.target.value)}
                className="h-10 text-xs"
              >
                <option value="">-- {tRes("fieldSpecificUnit")} --</option>
                {(SAMPLE_ASSIGNABLE_UNITS[formUnitTypeId] || [])
                  .filter((u) => u.conditionStatus === "Clean")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unitNumber} ({resolveLocalizedText(u.buildingName, locale)} - Floor {u.floorNumber})
                    </option>
                  ))}
              </SelectPill>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "tab-customer-deposit",
      label: tRes("tabCustomerAndDeposit"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-ink">
              {tRes("fieldCustomer")}
            </Label>
            <EntityAutocomplete
              id="admin-reservation-customer"
              options={customerOptions}
              value={formCustomerId}
              onValueChange={(val) => setFormCustomerId(val)}
              placeholder={tRes("fieldCustomer")}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-ink">
              {tRes("fieldDepositAmount")}
            </Label>
            <Input
              type="number"
              value={formDepositAmount}
              onChange={(e) => setFormDepositAmount(Number(e.target.value))}
              className="h-10 rounded-full font-mono text-xs"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant={formConfirmImmediately ? "default" : "outline"}
              size="sm"
              onClick={() => setFormConfirmImmediately(!formConfirmImmediately)}
              className="rounded-full text-xs h-8 px-4"
            >
              {tRes("fieldConfirmImmediately")}
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      {/* 1. Header & Summary KPI Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CommandTag prefixCode="RES">RESERVATIONS & AVAILABILITY</CommandTag>
            <Badge
              variant="outline"
              className="rounded-full font-mono text-xs px-2.5 py-0.5 bg-surface-soft"
            >
              {tRes("badgeTotal", { count: kpiTotal })}
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full font-mono text-xs px-2.5 py-0.5 bg-surface-soft"
            >
              {tRes("badgeHold", { count: kpiHold })}
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full font-mono text-xs px-2.5 py-0.5 bg-surface-soft"
            >
              {tRes("badgePending", { count: kpiPending })}
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full font-mono text-xs px-2.5 py-0.5 bg-surface-soft"
            >
              {tRes("badgeUnassigned", { count: kpiUnassigned })}
            </Badge>
          </div>
          <h2 className="font-rounded text-xl font-semibold tracking-tight text-ink">
            {tRes("title")}
          </h2>
          <p className="text-xs text-body">{tRes("description")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsInspectorOpen(true)}
            className="rounded-full text-xs font-mono h-9 px-4 gap-1.5"
          >
            <BarChart3 className="h-4 w-4" />
            <span>{tRes("inspectAvailability")}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleOpenCreateModal}
            className="rounded-full text-xs h-9 px-4 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>{tRes("createReservation")}</span>
          </Button>
        </div>
      </div>

      {/* 2. KPI Metrics Summary Strip */}
      <KpiSummaryStrip items={kpiItems} />

      {/* 3. List Toolbar (Search & Multi-Filters) */}
      <ListToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={tRes("searchPlaceholder")}
        filters={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <SelectPill
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 text-xs w-full sm:w-44"
            >
              <option value="All">{tRes("filterStatusAll")}</option>
              <option value="Hold">{tRes("statusHold")}</option>
              <option value="PendingVerification">
                {tRes("statusPendingVerification")}
              </option>
              <option value="Confirmed">{tRes("statusConfirmed")}</option>
              <option value="CheckedIn">{tRes("statusCheckedIn")}</option>
              <option value="Expired">{tRes("statusExpired")}</option>
              <option value="Cancelled">{tRes("statusCancelled")}</option>
              <option value="NoShow">{tRes("statusNoShow")}</option>
            </SelectPill>

            <SelectPill
              value={stayModeFilter}
              onChange={(e) => setStayModeFilter(e.target.value)}
              className="h-10 text-xs w-full sm:w-40"
            >
              <option value="All">{tRes("filterStayModeAll")}</option>
              <option value="Hourly">{tModes("Hourly")}</option>
              <option value="Daily">{tModes("Daily")}</option>
              <option value="Monthly">{tModes("Monthly")}</option>
            </SelectPill>
          </div>
        }
      />

      {/* 4. Table-Preserved DataTable */}
      <DataTable
        columns={columns}
        data={filteredReservations}
        getRowId={(row) => row.id}
        enableRowSelection
        selectedRowIds={selectedRowIds}
        onSelectionChange={setSelectedRowIds}
        enablePagination
        pageSize={20}
        emptyTitle={tRes("emptyReservations")}
        className="border border-hairline rounded-[12px] overflow-hidden"
      />

      <BulkActionToolbar
        selectedCount={selectedRowIds.length}
        onClearSelection={() => setSelectedRowIds([])}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full text-xs h-7 text-canvas border-canvas/40 hover:bg-canvas/20"
            onClick={() => setSelectedRowIds([])}
          >
            {tCommon("actions")}
          </Button>
        }
      />

      {/* --- Assign Physical Unit Dialog --- */}
      <Dialog
        open={isAssignModalOpen}
        onOpenChange={(open) => {
          if (!open) setIsAssignModalOpen(false);
        }}
      >
        <DialogContent className="max-w-md rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="font-rounded text-lg text-ink">
              {tRes("modalTitleAssign", {
                doc: targetReservation?.documentNumber || "",
              })}
            </DialogTitle>
            <DialogDescription className="text-xs text-body">
              {tRes("modalDescAssign")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTriggerAssignSubmit} className="space-y-4 pt-2">
            {availableCleanUnits.length === 0 ? (
              <div className="p-3 bg-surface-soft border border-hairline rounded-[12px] text-xs text-mute">
                {tRes("noCleanUnits")}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-ink">
                  {tRes("selectUnitLabel")}
                </Label>
                <SelectPill
                  value={selectedUnitForAssign}
                  onChange={(e) => setSelectedUnitForAssign(e.target.value)}
                  className="h-10 text-xs"
                >
                  {availableCleanUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unitNumber} ({resolveLocalizedText(u.buildingName, locale)} - Floor {u.floorNumber})
                    </option>
                  ))}
                </SelectPill>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-hairline">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAssignModalOpen(false)}
                className="rounded-full text-xs h-9 px-4"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || availableCleanUnits.length === 0}
                className="rounded-full text-xs h-9 px-6 font-medium"
              >
                {tRes("saveAssign")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Confirmation */}
      <ConfirmationModal
        isOpen={isConfirmAssignOpen}
        onClose={() => setIsConfirmAssignOpen(false)}
        onConfirm={handleConfirmAssignUnit}
        title={tRes("confirmAssignTitle")}
        message={tRes("confirmAssignMessage")}
        confirmText={tRes("saveAssign")}
        cancelText={tCommon("cancel")}
        variant="warning"
        isLoading={isSubmitting}
      />

      {/* Approve / Confirm Confirmation */}
      <ConfirmationModal
        isOpen={isConfirmApproveOpen}
        onClose={() => setIsConfirmApproveOpen(false)}
        onConfirm={handleApproveReservation}
        title={tRes("confirmModalTitle")}
        message={tRes("confirmModalMessage")}
        confirmText={tRes("actionConfirm")}
        cancelText={tCommon("cancel")}
        variant="info"
        isLoading={isSubmitting}
      />

      {/* --- Cancel / No-Show Dialog --- */}
      <Dialog
        open={isCancelModalOpen}
        onOpenChange={(open) => {
          if (!open) setIsCancelModalOpen(false);
        }}
      >
        <DialogContent className="max-w-md rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="font-rounded text-lg text-ink">
              {tRes("modalTitleCancel", {
                doc: targetReservation?.documentNumber || "",
              })}
            </DialogTitle>
            <DialogDescription className="text-xs text-body">
              {tRes("modalDescCancel")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTriggerCancelSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRes("cancelTypeLabel")}
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={cancelType === "cancel" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCancelType("cancel")}
                  className="rounded-full text-xs h-8 px-4"
                >
                  {tRes("typeCancel")}
                </Button>
                <Button
                  type="button"
                  variant={cancelType === "no-show" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCancelType("no-show")}
                  className="rounded-full text-xs h-8 px-4"
                >
                  {tRes("typeNoShow")}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRes("reasonLabel")}
              </Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={tRes("reasonPlaceholder")}
                className="min-h-[80px] text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-hairline">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCancelModalOpen(false)}
                className="rounded-full text-xs h-9 px-4"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !cancelReason.trim()}
                className="rounded-full text-xs h-9 px-6 font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {tRes("saveCancel")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <ConfirmationModal
        isOpen={isConfirmCancelOpen}
        onClose={() => setIsConfirmCancelOpen(false)}
        onConfirm={handleConfirmCancel}
        title={tRes("confirmCancelTitle")}
        message={tRes("confirmCancelMessage")}
        confirmText={tRes("saveCancel")}
        cancelText={tCommon("cancel")}
        variant="danger"
        isLoading={isSubmitting}
      />

      {/* --- Admin Create Reservation Dialog --- */}
      <Dialog
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          if (!open) setIsCreateModalOpen(false);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="font-rounded text-lg text-ink">
              {tRes("modalTitleCreate")}
            </DialogTitle>
            <DialogDescription className="text-xs text-body">
              {tRes("modalDescCreate")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTriggerCreateSubmit} className="space-y-6 pt-2">
            <FormTabs
              tabs={createFormTabs}
              value={createActiveTab}
              onValueChange={setCreateActiveTab}
            />

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-hairline">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-full text-xs h-9 px-4"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full text-xs h-9 px-6 font-medium"
              >
                {tRes("saveCreate")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Confirmation */}
      <ConfirmationModal
        isOpen={isConfirmCreateOpen}
        onClose={() => setIsConfirmCreateOpen(false)}
        onConfirm={handleConfirmCreateReservation}
        title={tRes("confirmCreateTitle")}
        message={tRes("confirmCreateMessage")}
        confirmText={tRes("saveCreate")}
        cancelText={tCommon("cancel")}
        variant="info"
        isLoading={isSubmitting}
      />

      {/* --- Availability Inspector Dialog --- */}
      <Dialog
        open={isInspectorOpen}
        onOpenChange={(open) => {
          if (!open) setIsInspectorOpen(false);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="font-rounded text-lg text-ink">
              {tRes("modalTitleInspector")}
            </DialogTitle>
            <DialogDescription className="text-xs text-body">
              {tRes("modalDescInspector")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {availabilityItems.map((item) => (
                <div
                  key={item.unitType.id}
                  className="rounded-[12px] border border-hairline p-4 space-y-3 bg-surface-soft/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-rounded font-semibold text-sm text-ink">
                      {resolveLocalizedText(item.unitType.name, locale)}
                    </span>
                    <span className="font-mono text-xs text-mute">
                      {item.unitType.code}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-mute">{tRes("colTotal")}:</span>
                      <span className="text-ink font-medium">
                        {item.totalPhysicalUnits}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mute">{tRes("colHeld")}:</span>
                      <span className="text-destructive font-medium">
                        {item.unassignedQuotaHeld}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-hairline pt-1">
                      <span className="text-ink font-semibold">
                        {tRes("colNet")}:
                      </span>
                      <span className="text-primary font-bold">
                        {item.netAvailableQuota} rooms
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-mute pt-1 border-t border-hairline flex flex-col gap-0.5 font-mono">
                    <span>
                      Rates from {formatCurrencyThb(item.estimatedRoomRate)}
                    </span>
                    <span>
                      Deposit: {formatCurrencyThb(item.estimatedDepositAmount)}
                    </span>
                    {item.turnaroundBufferMinutes > 0 && (
                      <span>Buffer: {item.turnaroundBufferMinutes}m</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-hairline">
              <Button
                type="button"
                onClick={() => setIsInspectorOpen(false)}
                className="rounded-full text-xs h-9 px-6 font-medium"
              >
                {tRes("closeInspector")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
