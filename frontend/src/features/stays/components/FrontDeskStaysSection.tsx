"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CommandTag } from "@/components/ui/command-tag";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Textarea } from "@/components/ui/textarea";
import { useDataTableState } from "@/hooks/use-data-table-state";
import { ListToolbar } from "@/components/layout/list-toolbar";
import { KpiSummaryStrip, type KpiItem } from "@/components/layout/kpi-summary-strip";
import { formatCurrencyThb, formatDecimal } from "@/lib/formatters";
import { BulkActionToolbar } from "@/components/layout/bulk-action-toolbar";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { DeferredFilePicker } from "@/components/ui/deferred-file-picker";
import { Tooltip } from "@/components/ui/tooltip";
import { useDeferredFileUpload } from "@/hooks/use-deferred-file-upload";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { AlertTriangle, Clock, FileText, Globe, LogOut, Plus, Receipt } from "lucide-react";
import {
  INITIAL_STAYS,
  INITIAL_REGULATORY_GUEST_ROWS,
  SAMPLE_PROPERTY,
  SAMPLE_UNITS_FOR_STAY,
  SAMPLE_UNITS_FOR_STAY_MAP,
} from "../constants";
import type {
  StayDetailDto,
  RegulatoryGuestRowDto,
  StayStatusType,
  FrontDeskStayMode,
  FolioTaxModeType,
  FolioPaymentMethodType,
  RegulatoryReportType,
  FolioChargeItemDto,
  StayOccupantDto,
} from "../types";

export interface FrontDeskStaysSectionProps {
  initialStays?: StayDetailDto[];
  initialRegulatoryRows?: RegulatoryGuestRowDto[];
}

export function FrontDeskStaysSection({
  initialStays = INITIAL_STAYS,
  initialRegulatoryRows = INITIAL_REGULATORY_GUEST_ROWS,
}: FrontDeskStaysSectionProps) {
  const locale = useLocale() as "th" | "en";
  const tStays = useTranslations("admin.stays");
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");

  // In-memory stays data
  const [stays, setStays] = useState<StayDetailDto[]>(initialStays);
  const [regulatoryRows, setRegulatoryRows] = useState<RegulatoryGuestRowDto[]>(
    initialRegulatoryRows
  );

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

  // Active target stay
  const [selectedStayId, setSelectedStayId] = useState<string | null>(null);

  // Modals visibility
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [isFolioModalOpen, setIsFolioModalOpen] = useState(false);
  const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);
  const [isRegulatoryModalOpen, setIsRegulatoryModalOpen] = useState(false);

  // Confirmations
  const [isConfirmCheckInOpen, setIsConfirmCheckInOpen] = useState(false);
  const [isConfirmDirtyOverrideOpen, setIsConfirmDirtyOverrideOpen] =
    useState(false);
  const [isConfirmExtendOpen, setIsConfirmExtendOpen] = useState(false);
  const [isConfirmCheckOutOpen, setIsConfirmCheckOutOpen] = useState(false);
  const [isConfirmUnmaskOpen, setIsConfirmUnmaskOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Regulatory State
  const [regulatoryReportType, setRegulatoryReportType] =
    useState<RegulatoryReportType>("RR4");
  const [isPiiUnmasked, setIsPiiUnmasked] = useState(false);
  const [csvCopied, setCsvCopied] = useState(false);

  // --- Extend Stay Form State ---
  const [extendHours, setExtendHours] = useState(1);

  // --- Folio Form State ---
  const [folioActiveTab, setFolioActiveTab] = useState("tab-charges");
  const [newChargeDescTh, setNewChargeDescTh] = useState("");
  const [newChargeDescEn, setNewChargeDescEn] = useState("");
  const [newChargeAmount, setNewChargeAmount] = useState(150);
  const [newChargeTaxMode, setNewChargeTaxMode] =
    useState<FolioTaxModeType>("VatIncluded");
  const [paymentAmount, setPaymentAmount] = useState(120);
  const [paymentMethod, setPaymentMethod] =
    useState<FolioPaymentMethodType>("Cash");

  // --- Check-Out Form State ---
  const [keyDepositDeduction, setKeyDepositDeduction] = useState(0);
  const [deductionReason, setDeductionReason] = useState("");

  // --- Check-In Form State ---
  const [checkInActiveTab, setCheckInActiveTab] = useState("tab-room-mode");
  const [formUnitId, setFormUnitId] = useState(SAMPLE_UNITS_FOR_STAY[0].id);
  const [formStayMode, setFormStayMode] = useState<FrontDeskStayMode>("Hourly");
  const [formDurationHours, setFormDurationHours] = useState(3);
  const [formDurationDays, setFormDurationDays] = useState(1);
  const [dirtyOverrideReason, setDirtyOverrideReason] = useState("");
  const [primaryGuestName, setPrimaryGuestName] = useState("Alice Smith");
  const [primaryNationality, setPrimaryNationality] = useState("USA");
  const [primaryIdNumber, setPrimaryIdNumber] = useState("US-PASS-5544332");
  const [primaryLicensePlate, setPrimaryLicensePlate] = useState("3EF-7890");
  const [additionalOccupants, setAdditionalOccupants] = useState<
    { name: string; nationality: string; idNum: string }[]
  >([]);
  const [formKeyDeposit, setFormKeyDeposit] = useState(500);

  // Deferred File Upload for Check-In ID Card/Passport
  const {
    queuedFiles,
    stageFiles,
    removeFile,
    commitUploads,
    isUploading,
  } = useDeferredFileUpload({ maxFiles: 1 });

  // Memoized stays lookup map (Zero .find() in UI components)
  const staysMap = useMemo(() => {
    return Object.fromEntries(stays.map((s) => [s.id, s]));
  }, [stays]);

  // Selected target stay object
  const targetStay = useMemo(() => {
    return (selectedStayId ? staysMap[selectedStayId] : null) ?? null;
  }, [staysMap, selectedStayId]);

  // Selected unit object for check-in
  const selectedUnitForCheckIn = useMemo(() => {
    return SAMPLE_UNITS_FOR_STAY_MAP[formUnitId] ?? SAMPLE_UNITS_FOR_STAY[0];
  }, [formUnitId]);

  // Filtered Stays
  const filteredStays = useMemo(() => {
    return stays.filter((stay) => {
      const matchesStatus =
        statusFilter === "All" || stay.status === statusFilter;
      const matchesStayMode =
        stayModeFilter === "All" || stay.stayMode === stayModeFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        stay.documentNumber.toLowerCase().includes(q) ||
        stay.unit.unitNumber.toLowerCase().includes(q) ||
        stay.customer.fullName.toLowerCase().includes(q);
      return matchesStatus && matchesStayMode && matchesQuery;
    });
  }, [stays, statusFilter, stayModeFilter, searchQuery]);

  // Summary KPIs
  const kpiActive = stays.filter((s) => s.status === "Active").length;
  const kpiOvertime = stays.filter(
    (s) => s.status === "Active" && (s.isOvertime || (s.remainingMinutes ?? 999) <= 15)
  ).length;
  const kpiUnsettled = stays.filter(
    (s) => s.status === "Active" && s.folio.balanceDue > 0
  ).length;
  const kpiForeigners = regulatoryRows.filter(
    (r) => r.nationalityCode !== "THA"
  ).length;

  const kpiItems: KpiItem[] = [
    {
      id: "active",
      label: tStays("badgeActiveLabel"),
      value: kpiActive,
      icon: <Receipt className="h-4 w-4" />,
    },
    {
      id: "overtime",
      label: tStays("badgeOvertimeLabel"),
      value: kpiOvertime,
      icon: <Clock className={`h-4 w-4 ${kpiOvertime > 0 ? "text-terminal-red" : "text-mute"}`} />,
      isAlert: kpiOvertime > 0,
    },
    {
      id: "unsettled",
      label: tStays("badgeUnsettledLabel"),
      value: kpiUnsettled,
      icon: <AlertTriangle className={`h-4 w-4 ${kpiUnsettled > 0 ? "text-amber-500" : "text-mute"}`} />,
      isAlert: kpiUnsettled > 0,
    },
    {
      id: "foreigners",
      label: tStays("badgeForeignersLabel"),
      value: kpiForeigners,
      icon: <Globe className="h-4 w-4" />,
    },
  ];

  // Handlers for Extend Stay
  const handleOpenExtend = (stay: StayDetailDto) => {
    setSelectedStayId(stay.id);
    setExtendHours(1);
    setIsExtendModalOpen(true);
  };

  const handleTriggerExtendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsConfirmExtendOpen(true);
  };

  const handleConfirmExtend = async () => {
    if (!selectedStayId || !targetStay) return;
    setIsSubmitting(true);
    try {
      const addedAmount = extendHours * 120;
      const newCharge: FolioChargeItemDto = {
        id: `chg-${Date.now()}`,
        description: {
          th: tStays(extendHours === 1 ? "extendOption1" : extendHours === 2 ? "extendOption2" : "extendOption3"),
          en: `Stay Extension (+${extendHours} hrs)`,
        },
        amount: addedAmount,
        taxMode: "VatIncluded",
      };

      setStays((prev) =>
        prev.map((s) => {
          if (s.id !== selectedStayId) return s;
          const updatedCharges = [...s.folio.charges, newCharge];
          const updatedTotalCharges = s.folio.totalCharges + addedAmount;
          const updatedBalanceDue = updatedTotalCharges - s.folio.totalPayments;
          const currentRemaining = s.remainingMinutes ?? 0;
          const newRemaining = currentRemaining + extendHours * 60;

          return {
            ...s,
            remainingMinutes: newRemaining,
            isOvertime: newRemaining < 0,
            folio: {
              ...s.folio,
              charges: updatedCharges,
              totalCharges: updatedTotalCharges,
              balanceDue: updatedBalanceDue,
            },
          };
        })
      );

      setIsConfirmExtendOpen(false);
      setIsExtendModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers for Folio
  const handleOpenFolio = (stay: StayDetailDto) => {
    setSelectedStayId(stay.id);
    setFolioActiveTab("tab-charges");
    setNewChargeDescTh("");
    setNewChargeDescEn("");
    setNewChargeAmount(150);
    setNewChargeTaxMode("VatIncluded");
    setPaymentAmount(stay.folio.balanceDue > 0 ? stay.folio.balanceDue : 100);
    setPaymentMethod("Cash");
    setIsFolioModalOpen(true);
  };

  const handleAddFolioCharge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStayId || !targetStay || newChargeAmount <= 0) return;

    const charge: FolioChargeItemDto = {
      id: `chg-${Date.now()}`,
      description: {
        th: newChargeDescTh.trim() || newChargeDescEn.trim() || tStays("tabAddCharge"),
        en: newChargeDescEn.trim() || newChargeDescTh.trim() || "Additional Service",
      },
      amount: Number(newChargeAmount),
      taxMode: newChargeTaxMode,
    };

    setStays((prev) =>
      prev.map((s) => {
        if (s.id !== selectedStayId) return s;
        const charges = [...s.folio.charges, charge];
        const totalCharges = s.folio.totalCharges + charge.amount;
        const balanceDue = totalCharges - s.folio.totalPayments;
        return {
          ...s,
          folio: {
            ...s.folio,
            charges,
            totalCharges,
            balanceDue,
          },
        };
      })
    );

    setNewChargeDescTh("");
    setNewChargeDescEn("");
    setFolioActiveTab("tab-charges");
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStayId || !targetStay || paymentAmount <= 0) return;

    setStays((prev) =>
      prev.map((s) => {
        if (s.id !== selectedStayId) return s;
        const totalPayments = s.folio.totalPayments + Number(paymentAmount);
        const balanceDue = Math.max(0, s.folio.totalCharges - totalPayments);
        return {
          ...s,
          folio: {
            ...s.folio,
            totalPayments,
            balanceDue,
          },
        };
      })
    );

    setFolioActiveTab("tab-charges");
  };

  // Handlers for Check-Out
  const handleOpenCheckOut = (stay: StayDetailDto) => {
    setSelectedStayId(stay.id);
    setKeyDepositDeduction(0);
    setDeductionReason("");
    setIsCheckOutModalOpen(true);
  };

  const handleTriggerCheckOutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStay || targetStay.folio.balanceDue > 0) return;
    setIsConfirmCheckOutOpen(true);
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedStayId || !targetStay) return;
    setIsSubmitting(true);
    try {
      setStays((prev) =>
        prev.map((s) => {
          if (s.id !== selectedStayId) return s;
          return {
            ...s,
            status: "CheckedOut",
            checkOutAt: new Date().toISOString(),
            remainingMinutes: 0,
            isOvertime: false,
            keyDepositBalance: 0,
            generatedHousekeepingTaskStatus: "Pending",
          };
        })
      );

      setIsConfirmCheckOutOpen(false);
      setIsCheckOutModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers for Check-In / Walk-in
  const handleOpenCheckInModal = () => {
    setFormUnitId(SAMPLE_UNITS_FOR_STAY[0].id);
    setFormStayMode("Hourly");
    setFormDurationHours(3);
    setFormDurationDays(1);
    setDirtyOverrideReason("");
    setPrimaryGuestName("Alice Smith");
    setPrimaryNationality("USA");
    setPrimaryIdNumber("US-PASS-5544332");
    setPrimaryLicensePlate("3EF-7890");
    setAdditionalOccupants([]);
    setFormKeyDeposit(500);
    setCheckInActiveTab("tab-room-mode");
    setIsCheckInModalOpen(true);
  };

  const handleAddOccupantRow = () => {
    setAdditionalOccupants((prev) => [
      ...prev,
      { name: "", nationality: "THA", idNum: "" },
    ]);
  };

  const handleRemoveOccupantRow = (index: number) => {
    setAdditionalOccupants((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleTriggerCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUnitForCheckIn.conditionStatus === "Dirty" && !dirtyOverrideReason.trim()) {
      return;
    }

    if (selectedUnitForCheckIn.conditionStatus === "Dirty") {
      setIsConfirmDirtyOverrideOpen(true);
    } else {
      setIsConfirmCheckInOpen(true);
    }
  };

  const handleConfirmCheckInExecution = async () => {
    setIsSubmitting(true);
    try {
      if (queuedFiles.length > 0) {
        await commitUploads(async (file) => {
          return `https://storage.tan-pms.internal/credentials/${file.name}`;
        });
      }

      const seqNumber = String(stays.length + 1).padStart(4, "0");
      const docNumber = `BKK01-STY-2611-${seqNumber}`;

      const baseRoomPrice = formStayMode === "Hourly" ? 450 : 1290;
      const initialCharge: FolioChargeItemDto = {
        id: `chg-${Date.now()}-init`,
        description: {
          th: formStayMode === "Hourly" ? tModes("Hourly") : tModes("Daily"),
          en: formStayMode === "Hourly" ? "Hourly Room Charge (3 hrs)" : "Daily Room Charge (1 Night)",
        },
        amount: baseRoomPrice,
        taxMode: "VatIncluded",
      };

      const primaryOccupant: StayOccupantDto = {
        id: `occ-${Date.now()}-primary`,
        fullName: primaryGuestName.trim(),
        nationalityCode: primaryNationality.trim().toUpperCase() || "THA",
        maskedIdentityNumber: primaryIdNumber.slice(0, 3) + "-XXXX-" + primaryIdNumber.slice(-3),
        isPrimaryOccupant: true,
        vehicleLicensePlate: primaryLicensePlate.trim() || null,
      };

      const otherOccupants: StayOccupantDto[] = additionalOccupants
        .filter((o) => o.name.trim())
        .map((o, idx) => ({
          id: `occ-${Date.now()}-${idx + 1}`,
          fullName: o.name.trim(),
          nationalityCode: o.nationality.trim().toUpperCase() || "THA",
          maskedIdentityNumber: o.idNum ? o.idNum.slice(0, 3) + "-XXXX-" + o.idNum.slice(-3) : "ID-XXXX",
          isPrimaryOccupant: false,
          vehicleLicensePlate: null,
        }));

      const allOccupants = [primaryOccupant, ...otherOccupants];

      const newStay: StayDetailDto = {
        id: `sty-${Date.now()}`,
        documentNumber: docNumber,
        property: SAMPLE_PROPERTY,
        unit: selectedUnitForCheckIn,
        customer: {
          id: `cus-${Date.now()}`,
          fullName: primaryGuestName.trim(),
          maskedNationalId: primaryOccupant.maskedIdentityNumber,
        },
        reservationDocumentNumber: null,
        stayMode: formStayMode,
        status: "Active",
        checkInAt: new Date().toISOString(),
        expectedCheckOutAt: new Date(
          Date.now() + (formStayMode === "Hourly" ? formDurationHours * 3600000 : formDurationDays * 86400000)
        ).toISOString(),
        checkOutAt: null,
        remainingMinutes: formStayMode === "Hourly" ? formDurationHours * 60 : formDurationDays * 1440,
        isOvertime: false,
        keyDepositAmount: Number(formKeyDeposit) || 0,
        keyDepositBalance: Number(formKeyDeposit) || 0,
        folio: {
          id: `fol-${Date.now()}`,
          charges: [initialCharge],
          totalCharges: baseRoomPrice,
          totalPayments: baseRoomPrice,
          balanceDue: 0,
        },
        occupants: allOccupants,
        generatedHousekeepingTaskStatus: null,
      };

      // Add to stays
      setStays((prev) => [newStay, ...prev]);

      // Add to regulatory rows
      const newRegulatoryRows: RegulatoryGuestRowDto[] = allOccupants.map((occ) => ({
        occupantId: occ.id,
        sourceDocumentNumber: docNumber,
        unitNumber: selectedUnitForCheckIn.unitNumber,
        fullName: occ.fullName,
        nationalityCode: occ.nationalityCode,
        identityNumber: primaryIdNumber,
        isPrimaryOccupant: occ.isPrimaryOccupant,
        vehicleLicensePlate: occ.vehicleLicensePlate,
        checkInAt: newStay.checkInAt,
        checkOutAt: null,
        stayMode: formStayMode,
      }));

      setRegulatoryRows((prev) => [...newRegulatoryRows, ...prev]);

      setIsConfirmCheckInOpen(false);
      setIsConfirmDirtyOverrideOpen(false);
      setIsCheckInModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Regulatory Filtered Rows
  const displayedRegulatoryRows = useMemo(() => {
    if (regulatoryReportType === "TM30") {
      return regulatoryRows.filter((r) => r.nationalityCode !== "THA");
    }
    return regulatoryRows;
  }, [regulatoryRows, regulatoryReportType]);

  // Regulatory CSV Preview Content
  const regulatoryCsvContent = useMemo(() => {
    const header = "ReportType,SourceDoc,UnitNumber,FullName,Nationality,IdentityNumber,CheckInAt,StayMode\n";
    const body = displayedRegulatoryRows
      .map((r) => {
        const idDisplay = isPiiUnmasked
          ? r.identityNumber
          : r.identityNumber.slice(0, 3) + "-XXXX-" + r.identityNumber.slice(-3);
        return `${regulatoryReportType},${r.sourceDocumentNumber},${r.unitNumber},"${r.fullName}",${r.nationalityCode},${idDisplay},${r.checkInAt},${r.stayMode}`;
      })
      .join("\n");
    return header + body;
  }, [displayedRegulatoryRows, regulatoryReportType, isPiiUnmasked]);

  const handleCopyCsv = () => {
    navigator.clipboard?.writeText(regulatoryCsvContent);
    setCsvCopied(true);
    setTimeout(() => setCsvCopied(false), 2000);
  };

  // DataTable Columns (Table-Preserved Architecture)
  const columns: ColumnDef<StayDetailDto>[] = [
    {
      id: "docAndUnit",
      header: tStays("colDocUnit"),
      sortable: true,
      sortValue: (row) => row.documentNumber,
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <CommandTag prefixCode="STY">{row.documentNumber}</CommandTag>
          <span className="font-mono text-xs font-semibold text-primary">
            Unit {row.unit.unitNumber}
          </span>
        </div>
      ),
    },
    {
      id: "modeAndTimer",
      header: tStays("colModeTimer"),
      cell: (row) => {
        const isHourly = row.stayMode === "Hourly";
        const remMinutes = row.remainingMinutes ?? 0;

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="rounded-full font-mono text-[10px] px-2 py-0.5 bg-surface-soft"
              >
                {tModes(row.stayMode)}
              </Badge>
              {row.status === "Active" && isHourly && (
                <>
                  {row.isOvertime ? (
                    <Badge
                      variant="destructive"
                      className="rounded-full text-[10px] font-mono px-2 py-0.5 animate-pulse"
                    >
                      {tStays("overtimeBadge", {
                        minutes: Math.abs(remMinutes),
                      })}
                    </Badge>
                  ) : remMinutes <= 15 ? (
                    <Badge
                      variant="outline"
                      className="rounded-full text-[10px] font-mono px-2 py-0.5 text-ink bg-surface-soft border-hairline font-semibold"
                    >
                      {tStays("nearExpiryBadge", { minutes: remMinutes })}
                    </Badge>
                  ) : (
                    <span className="font-mono text-[11px] text-body tabular-nums">
                      {tStays("remainingLabel", { minutes: remMinutes })}
                    </span>
                  )}
                </>
              )}
            </div>
            <span className="font-mono text-[10px] text-mute tabular-nums">
              In: {row.checkInAt.slice(11, 16)} • Out:{" "}
              {row.expectedCheckOutAt ? row.expectedCheckOutAt.slice(11, 16) : "--:--"}
            </span>
          </div>
        );
      },
    },
    {
      id: "guestAndOccupants",
      header: tStays("colGuestOccupants"),
      cell: (row) => {
        const hasForeigner = row.occupants.some(
          (o) => o.nationalityCode !== "THA"
        );

        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-xs text-ink">
              {row.customer.fullName}
            </span>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="rounded-full text-[10px] font-mono px-1.5 py-0.2"
              >
                {tStays("occupantCountBadge", {
                  count: row.occupants.length,
                })}
              </Badge>
              {hasForeigner && (
                <Badge
                  variant="outline"
                  className="rounded-full text-[9px] font-mono px-1.5 py-0.2 bg-surface-soft"
                >
                  {tStays("foreignerBadge")}
                </Badge>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "folioAndDeposit",
      header: tStays("colFolioDeposit"),
      sortable: true,
      sortValue: (row) => row.folio.balanceDue,
      align: "right",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            {row.folio.balanceDue > 0 ? (
              <Badge
                variant="outline"
                className="rounded-full text-[10px] font-mono px-2 py-0.5 text-destructive border-destructive/30"
              >
                {tStays("unsettledBadge", {
                  amount: formatDecimal(row.folio.balanceDue),
                })}
              </Badge>
            ) : (
              <Badge
                variant="default"
                className="rounded-full text-[10px] font-mono px-2 py-0.5"
              >
                {tStays("settledBadge")}
              </Badge>
            )}
          </div>
          <span className="font-mono text-[11px] text-mute tabular-nums">
            {tStays("keyDepositLabel", {
              amount: formatDecimal(row.keyDepositBalance),
            })}
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{tStays("colActions")}</span>,
      headerClassName: "w-[120px] text-right",
      className: "text-right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.status === "Active" && row.stayMode === "Hourly" && (
            <Tooltip content={tStays("actionExtend")} position="top">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleOpenExtend(row)}
                aria-label={tStays("actionExtend")}
                className="rounded-full h-7 w-7 text-xs font-mono"
              >
                <Clock className="h-3.5 w-3.5" />
                <span className="sr-only">{tStays("actionExtend")}</span>
              </Button>
            </Tooltip>
          )}

          <Tooltip content={tStays("actionFolio")} position="top">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleOpenFolio(row)}
              aria-label={tStays("actionFolio")}
              className="rounded-full h-7 w-7 text-xs"
            >
              <Receipt className="h-3.5 w-3.5" />
              <span className="sr-only">{tStays("actionFolio")}</span>
            </Button>
          </Tooltip>

          {row.status === "Active" && (
            <Tooltip content={tStays("actionCheckOut")} position="top">
              <Button
                type="button"
                size="icon"
                onClick={() => handleOpenCheckOut(row)}
                aria-label={tStays("actionCheckOut")}
                className="rounded-full h-7 w-7 text-xs bg-ink text-canvas hover:bg-neutral-800"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="sr-only">{tStays("actionCheckOut")}</span>
              </Button>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  // Folio Tabs Definition
  const folioTabs: FormTabItem[] = [
    {
      id: "tab-charges",
      label: tStays("tabCharges"),
      content: (
        <div className="space-y-4 pt-2">
          {targetStay?.folio.charges.length === 0 ? (
            <div className="p-4 text-center text-xs text-mute bg-surface-soft border border-hairline rounded-[12px]">
              No charges posted yet
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {targetStay?.folio.charges.map((chg) => (
                <div
                  key={chg.id}
                  className="flex items-center justify-between p-3 rounded-[12px] border border-hairline bg-surface-soft/40 text-xs font-mono"
                >
                  <div>
                    <span className="font-medium text-ink">
                      {resolveLocalizedText(chg.description, locale)}
                    </span>
                    <Badge
                      variant="outline"
                      className="ml-2 text-[9px] px-1.5 py-0.2"
                    >
                      {chg.taxMode}
                    </Badge>
                  </div>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrencyThb(chg.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Folio Summary Totals */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-surface-soft border border-hairline rounded-[12px] font-mono text-xs">
            <div>
              <span className="text-[10px] text-mute block">
                {tStays("totalChargesLabel")}
              </span>
              <span className="font-semibold text-ink">
                {formatCurrencyThb(targetStay?.folio.totalCharges ?? 0)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-mute block">
                {tStays("totalPaymentsLabel")}
              </span>
              <span className="font-semibold text-ink">
                {formatCurrencyThb(targetStay?.folio.totalPayments ?? 0)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-mute block">
                {tStays("balanceDueLabel")}
              </span>
              <span
                className={`font-bold text-sm ${
                  (targetStay?.folio.balanceDue ?? 0) > 0
                    ? "text-destructive"
                    : "text-primary"
                }`}
              >
                {formatCurrencyThb(targetStay?.folio.balanceDue ?? 0)}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "tab-add-charge",
      label: tStays("tabAddCharge"),
      content: (
        <form onSubmit={handleAddFolioCharge} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="charge-desc-th" className="text-xs font-medium text-ink">
                {tStays("fieldChargeDescTh")}
              </Label>
              <Input
                id="charge-desc-th"
                value={newChargeDescTh}
                onChange={(e) => setNewChargeDescTh(e.target.value)}
                className="h-10 rounded-full text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="charge-desc-en" className="text-xs font-medium text-ink">
                {tStays("fieldChargeDescEn")}
              </Label>
              <Input
                id="charge-desc-en"
                value={newChargeDescEn}
                onChange={(e) => setNewChargeDescEn(e.target.value)}
                className="h-10 rounded-full text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="charge-amount" className="text-xs font-medium text-ink">
                {tStays("fieldChargeAmount")}
              </Label>
              <Input
                id="charge-amount"
                type="number"
                value={newChargeAmount}
                onChange={(e) => setNewChargeAmount(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="charge-tax-mode" className="text-xs font-medium text-ink">
                {tStays("fieldTaxMode")}
              </Label>
              <SelectPill
                id="charge-tax-mode"
                value={newChargeTaxMode}
                onChange={(e) =>
                  setNewChargeTaxMode(e.target.value as FolioTaxModeType)
                }
                className="h-10 text-xs"
              >
                <option value="VatIncluded">VatIncluded (7%)</option>
                <option value="VatExcluded">VatExcluded (7%)</option>
                <option value="Exempt">Exempt (0%)</option>
              </SelectPill>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              className="rounded-full text-xs h-9 px-6 font-medium"
            >
              {tStays("saveAddCharge")}
            </Button>
          </div>
        </form>
      ),
    },
    {
      id: "tab-record-payment",
      label: tStays("tabRecordPayment"),
      content: (
        <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount" className="text-xs font-medium text-ink">
                {tStays("fieldPaymentAmount")}
              </Label>
              <Input
                id="payment-amount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-method" className="text-xs font-medium text-ink">
                {tStays("fieldPaymentMethod")}
              </Label>
              <SelectPill
                id="payment-method"
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as FolioPaymentMethodType)
                }
                className="h-10 text-xs"
              >
                <option value="Cash">{tStays("methodCash")}</option>
                <option value="BankTransfer">
                  {tStays("methodBankTransfer")}
                </option>
                <option value="PromptPay">{tStays("methodPromptPay")}</option>
              </SelectPill>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              className="rounded-full text-xs h-9 px-6 font-medium"
            >
              {tStays("saveRecordPayment")}
            </Button>
          </div>
        </form>
      ),
    },
  ];

  // Check-In Tabs Definition
  const checkInTabs: FormTabItem[] = [
    {
      id: "tab-room-mode",
      label: tStays("tabRoomMode"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="checkin-unit-select" className="text-xs font-medium text-ink">
              {tStays("fieldSelectUnit")}
            </Label>
            <SelectPill
              id="checkin-unit-select"
              value={formUnitId}
              onChange={(e) => setFormUnitId(e.target.value)}
              className="h-10 text-xs font-mono"
            >
              {SAMPLE_UNITS_FOR_STAY.map((u) => (
                <option key={u.id} value={u.id}>
                  Unit {u.unitNumber} ({resolveLocalizedText(u.unitTypeName, locale)}) —{" "}
                  {u.conditionStatus === "Clean"
                    ? tStays("cleanBadge")
                    : tStays("dirtyBadge")}
                </option>
              ))}
            </SelectPill>
          </div>

          {selectedUnitForCheckIn.conditionStatus === "Dirty" && (
            <div
              data-testid="dirty-unit-warning-box"
              className="p-3 rounded-[12px] bg-destructive/10 border border-destructive/20 space-y-2 text-xs"
            >
              <div className="text-destructive font-semibold">
                {tStays("dirtyRoomAlert")}
              </div>
              <div className="space-y-1">
                <Label htmlFor="dirty-override-reason" className="text-[11px] font-medium text-destructive">
                  {tStays("fieldDirtyOverrideReason")}
                </Label>
                <Textarea
                  id="dirty-override-reason"
                  value={dirtyOverrideReason}
                  onChange={(e) => setDirtyOverrideReason(e.target.value)}
                  placeholder={tStays("dirtyOverridePlaceholder")}
                  className="min-h-[72px] text-xs bg-canvas"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-ink">
              {tStays("fieldStayMode")}
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={formStayMode === "Hourly" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormStayMode("Hourly")}
                className="rounded-full text-xs font-mono h-8 px-4"
              >
                {tModes("Hourly")}
              </Button>
              <Button
                type="button"
                variant={formStayMode === "Daily" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormStayMode("Daily")}
                className="rounded-full text-xs font-mono h-8 px-4"
              >
                {tModes("Daily")}
              </Button>
            </div>
          </div>

          {formStayMode === "Hourly" ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tStays("fieldDurationHours")}
              </Label>
              <Input
                type="number"
                value={formDurationHours}
                onChange={(e) => setFormDurationHours(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tStays("fieldDurationDays")}
              </Label>
              <Input
                type="number"
                value={formDurationDays}
                onChange={(e) => setFormDurationDays(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
          )}
        </div>
      ),
    },
    {
      id: "tab-guests",
      label: tStays("tabGuests"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="primary-guest-name" className="text-xs font-medium text-ink">
                {tStays("fieldPrimaryGuestName")}
              </Label>
              <Input
                id="primary-guest-name"
                value={primaryGuestName}
                onChange={(e) => setPrimaryGuestName(e.target.value)}
                className="h-10 rounded-full text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary-nationality" className="text-xs font-medium text-ink">
                {tStays("fieldNationality")}
              </Label>
              <Input
                id="primary-nationality"
                value={primaryNationality}
                onChange={(e) => setPrimaryNationality(e.target.value)}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="primary-id-number" className="text-xs font-medium text-ink">
                {tStays("fieldIdentityNumber")}
              </Label>
              <Input
                id="primary-id-number"
                value={primaryIdNumber}
                onChange={(e) => setPrimaryIdNumber(e.target.value)}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary-license-plate" className="text-xs font-medium text-ink">
                {tStays("fieldLicensePlate")}
              </Label>
              <Input
                id="primary-license-plate"
                value={primaryLicensePlate}
                onChange={(e) => setPrimaryLicensePlate(e.target.value)}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
          </div>

          {/* Dynamic Additional Occupants */}
          <div className="pt-2 border-t border-hairline space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-rounded font-semibold text-xs text-ink">
                {tStays("occupantCountBadge", {
                  count: additionalOccupants.length + 1,
                })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOccupantRow}
                className="rounded-full text-xs h-7 px-3"
              >
                {tStays("addOccupant")}
              </Button>
            </div>

            {additionalOccupants.map((occ, idx) => (
              <div
                key={idx}
                className="p-3 rounded-[12px] bg-surface-soft border border-hairline space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-ink">
                    {tStays("occupantLabel", { index: idx + 2 })}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveOccupantRow(idx)}
                    className="rounded-full text-[10px] h-6 px-2 text-destructive"
                  >
                    {tStays("removeOccupant")}
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={occ.name}
                    placeholder="Full Name"
                    onChange={(e) => {
                      const updated = [...additionalOccupants];
                      updated[idx].name = e.target.value;
                      setAdditionalOccupants(updated);
                    }}
                    className="h-9 rounded-full text-xs"
                  />
                  <Input
                    value={occ.nationality}
                    placeholder="Nationality (e.g. THA)"
                    onChange={(e) => {
                      const updated = [...additionalOccupants];
                      updated[idx].nationality = e.target.value;
                      setAdditionalOccupants(updated);
                    }}
                    className="h-9 rounded-full font-mono text-xs"
                  />
                  <Input
                    value={occ.idNum}
                    placeholder="ID / Passport"
                    onChange={(e) => {
                      const updated = [...additionalOccupants];
                      updated[idx].idNum = e.target.value;
                      setAdditionalOccupants(updated);
                    }}
                    className="h-9 rounded-full font-mono text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "tab-deposit",
      label: tStays("tabDeposit"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-ink">
              {tStays("fieldKeyDepositAmount")}
            </Label>
            <Input
              type="number"
              value={formKeyDeposit}
              onChange={(e) => setFormKeyDeposit(Number(e.target.value))}
              className="h-10 rounded-full font-mono text-xs"
            />
          </div>

          <div className="space-y-2 pt-2">
            <Label className="text-xs font-medium text-ink">
              {tStays("fieldAttachIdPhoto")}
            </Label>
            <DeferredFilePicker
              queuedFiles={queuedFiles}
              onFilesSelected={stageFiles}
              onRemoveFile={removeFile}
              isUploading={isUploading}
              accept="image/*,.pdf"
              multiple={false}
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-rounded font-semibold tracking-tight text-ink">
            {tStays("title")}
          </h1>
          <p className="text-xs text-body mt-0.5">{tStays("description")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsRegulatoryModalOpen(true)}
            className="rounded-full text-xs font-mono h-9 px-4 gap-1.5"
          >
            <FileText className="h-4 w-4" />
            <span>{tStays("btnRegulatory")}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleOpenCheckInModal}
            className="rounded-full text-xs h-9 px-4 gap-1.5 shadow-none"
          >
            <Plus className="h-4 w-4" />
            <span>{tStays("btnCheckIn")}</span>
          </Button>
        </div>
      </div>

      {/* 2. Key Operational KPI Snapshot */}
      <KpiSummaryStrip items={kpiItems} />

      {/* 3. Toolbar (Unified Search & Filters, No Nested Card) */}
      <ListToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={tStays("searchPlaceholder")}
        filters={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <SelectPill
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 text-xs w-full sm:w-auto sm:min-w-[180px] pl-3 pr-7"
            >
              <option value="All">{tStays("filterStatusAll")}</option>
              <option value="Active">{tStays("statusActive")}</option>
              <option value="CheckedOut">{tStays("statusCheckedOut")}</option>
            </SelectPill>

            <SelectPill
              value={stayModeFilter}
              onChange={(e) => setStayModeFilter(e.target.value)}
              className="h-10 text-xs w-full sm:w-auto sm:min-w-[180px] pl-3 pr-7"
            >
              <option value="All">{tStays("filterStayModeAll")}</option>
              <option value="Hourly">{tModes("Hourly")}</option>
              <option value="Daily">{tModes("Daily")}</option>
            </SelectPill>
          </div>
        }
      />

      {/* 4. Table-Preserved DataTable */}
      <DataTable
        columns={columns}
        data={filteredStays}
        getRowId={(row) => row.id}
        enableRowSelection
        selectedRowIds={selectedRowIds}
        onSelectionChange={setSelectedRowIds}
        enablePagination
        pageSize={20}
        emptyTitle={tStays("emptyStays")}
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

      {/* --- Modal 1: Extend Stay Dialog --- */}
      <Dialog
        open={isExtendModalOpen}
        onOpenChange={(open) => {
          if (!open) setIsExtendModalOpen(false);
        }}
      >
        <DialogContent className="max-w-md rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="font-rounded text-lg text-ink">
              {tStays("modalTitleExtend", {
                doc: targetStay?.documentNumber || "",
                unit: targetStay?.unit.unitNumber || "",
              })}
            </DialogTitle>
            <DialogDescription className="text-xs text-body">
              {tStays("modalDescExtend")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTriggerExtendSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tStays("fieldAdditionalHours")}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((h) => (
                  <Button
                    key={h}
                    type="button"
                    variant={extendHours === h ? "default" : "outline"}
                    size="sm"
                    onClick={() => setExtendHours(h)}
                    className="rounded-full text-xs font-mono h-9"
                  >
                    +{h}h (+{h * 120} THB)
                  </Button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-surface-soft border border-hairline rounded-[12px] text-[11px] text-mute">
              {tStays("capNotice")}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-hairline">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsExtendModalOpen(false)}
                className="rounded-full text-xs h-9 px-4"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full text-xs h-9 px-6 font-medium"
              >
                {tStays("saveExtend")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Extend Confirmation */}
      <ConfirmationModal
        isOpen={isConfirmExtendOpen}
        onClose={() => setIsConfirmExtendOpen(false)}
        onConfirm={handleConfirmExtend}
        title={tStays("confirmExtendTitle")}
        message={tStays("confirmExtendMessage")}
        confirmText={tStays("saveExtend")}
        cancelText={tCommon("cancel")}
        variant="info"
        isLoading={isSubmitting}
      />

      {/* --- Modal 2: Guest Folio Dialog --- */}
      <Dialog
        open={isFolioModalOpen}
        onOpenChange={(open) => {
          if (!open) setIsFolioModalOpen(false);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="font-rounded text-lg text-ink">
              {tStays("modalTitleFolio", {
                doc: targetStay?.documentNumber || "",
              })}
            </DialogTitle>
            <DialogDescription className="text-xs text-body">
              {tStays("modalDescFolio")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <FormTabs
              tabs={folioTabs}
              value={folioActiveTab}
              onValueChange={setFolioActiveTab}
            />

            <div className="flex justify-end pt-4 border-t border-hairline">
              <Button
                type="button"
                onClick={() => setIsFolioModalOpen(false)}
                className="rounded-full text-xs h-9 px-6 font-medium"
              >
                {tStays("closeFolio")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Modal 3: Check-Out Dialog --- */}
      <Dialog
        open={isCheckOutModalOpen}
        onOpenChange={(open) => {
          if (!open) setIsCheckOutModalOpen(false);
        }}
      >
        <DialogContent className="max-w-md rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="font-rounded text-lg text-ink">
              {tStays("modalTitleCheckOut", {
                doc: targetStay?.documentNumber || "",
              })}
            </DialogTitle>
            <DialogDescription className="text-xs text-body">
              {tStays("modalDescCheckOut")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTriggerCheckOutSubmit} className="space-y-4 pt-2">
            {(targetStay?.folio.balanceDue ?? 0) > 0 ? (
              <div
                data-testid="folio-unsettled-warning-box"
                className="p-3 bg-destructive/10 border border-destructive/20 rounded-[12px] text-xs text-destructive font-medium"
              >
                {tStays("folioUnsettledWarning", {
                  amount: formatDecimal(targetStay?.folio.balanceDue ?? 0),
                })}
              </div>
            ) : (
              <>
                <div className="p-3 bg-surface-soft border border-hairline rounded-[12px] space-y-1 font-mono text-xs">
                  <span className="text-mute block">
                    {tStays("fieldKeyDepositRefund")}
                  </span>
                  <span className="font-bold text-sm text-primary">
                    {formatCurrencyThb(targetStay?.keyDepositBalance ?? 0)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="key-deduction-amount" className="text-xs font-medium text-ink">
                    {tStays("fieldDeductionAmount")}
                  </Label>
                  <Input
                    id="key-deduction-amount"
                    type="number"
                    value={keyDepositDeduction}
                    onChange={(e) =>
                      setKeyDepositDeduction(Number(e.target.value))
                    }
                    className="h-10 rounded-full font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="key-deduction-reason" className="text-xs font-medium text-ink">
                    {tStays("fieldDeductionReason")}
                  </Label>
                  <Textarea
                    id="key-deduction-reason"
                    value={deductionReason}
                    onChange={(e) => setDeductionReason(e.target.value)}
                    placeholder={tStays("deductionReasonPlaceholder")}
                    className="min-h-[72px] text-xs"
                  />
                </div>

                <div className="text-[11px] text-mute">
                  {tStays("housekeepingNotice")}
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-hairline">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCheckOutModalOpen(false)}
                className="rounded-full text-xs h-9 px-4"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting || (targetStay?.folio.balanceDue ?? 0) > 0
                }
                className="rounded-full text-xs h-9 px-6 font-medium"
              >
                {tStays("saveCheckOut")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Check-Out Confirmation */}
      <ConfirmationModal
        isOpen={isConfirmCheckOutOpen}
        onClose={() => setIsConfirmCheckOutOpen(false)}
        onConfirm={handleConfirmCheckOut}
        title={tStays("confirmCheckOutTitle")}
        message={tStays("confirmCheckOutMessage")}
        confirmText={tStays("saveCheckOut")}
        cancelText={tCommon("cancel")}
        variant="warning"
        isLoading={isSubmitting}
      />

      {/* --- Modal 4: Check-In / Walk-In Dialog --- */}
      <Dialog
        open={isCheckInModalOpen}
        onOpenChange={(open) => {
          if (!open) setIsCheckInModalOpen(false);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="font-rounded text-lg text-ink">
              {tStays("modalTitleCheckIn")}
            </DialogTitle>
            <DialogDescription className="text-xs text-body">
              {tStays("modalDescCheckIn")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTriggerCheckInSubmit} className="space-y-6 pt-2">
            <FormTabs
              tabs={checkInTabs}
              value={checkInActiveTab}
              onValueChange={setCheckInActiveTab}
            />

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-hairline">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCheckInModalOpen(false)}
                className="rounded-full text-xs h-9 px-4"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full text-xs h-9 px-6 font-medium"
              >
                {tStays("saveCheckIn")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Check-In Normal Confirmation */}
      <ConfirmationModal
        isOpen={isConfirmCheckInOpen}
        onClose={() => setIsConfirmCheckInOpen(false)}
        onConfirm={handleConfirmCheckInExecution}
        title={tStays("confirmCheckInTitle")}
        message={tStays("confirmCheckInMessage")}
        confirmText={tStays("saveCheckIn")}
        cancelText={tCommon("cancel")}
        variant="info"
        isLoading={isSubmitting}
      />

      {/* Check-In Dirty Override Confirmation */}
      <ConfirmationModal
        isOpen={isConfirmDirtyOverrideOpen}
        onClose={() => setIsConfirmDirtyOverrideOpen(false)}
        onConfirm={handleConfirmCheckInExecution}
        title={tStays("confirmDirtyOverrideTitle")}
        message={tStays("confirmDirtyOverrideMessage")}
        confirmText={tStays("saveCheckIn")}
        cancelText={tCommon("cancel")}
        variant="danger"
        isLoading={isSubmitting}
      />

      {/* --- Modal 5: Regulatory Export Dialog --- */}
      <Dialog
        open={isRegulatoryModalOpen}
        onOpenChange={(open) => {
          if (!open) setIsRegulatoryModalOpen(false);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="font-rounded text-lg text-ink">
              {tStays("modalTitleRegulatory")}
            </DialogTitle>
            <DialogDescription className="text-xs text-body">
              {tStays("modalDescRegulatory")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* View Switcher: RR4 vs TM30 */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center rounded-full bg-surface-soft border border-hairline p-1 gap-1">
                <Button
                  type="button"
                  variant={regulatoryReportType === "RR4" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setRegulatoryReportType("RR4")}
                  className="rounded-full text-xs font-mono h-7 px-3"
                >
                  {tStays("tabRR4")}
                </Button>
                <Button
                  type="button"
                  variant={regulatoryReportType === "TM30" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setRegulatoryReportType("TM30")}
                  className="rounded-full text-xs font-mono h-7 px-3"
                >
                  {tStays("tabTM30")}
                </Button>
              </div>

              {/* Unmask PII Button */}
              <Button
                type="button"
                variant={isPiiUnmasked ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (!isPiiUnmasked) {
                    setIsConfirmUnmaskOpen(true);
                  } else {
                    setIsPiiUnmasked(false);
                  }
                }}
                className="rounded-full text-xs font-mono h-8 px-4"
              >
                {tStays("unmaskPiiButton")}
              </Button>
            </div>

            {/* PDPA Notice */}
            <div className="text-[11px] text-mute font-mono">
              {isPiiUnmasked
                ? tStays("unmaskedPiiNotice")
                : tStays("maskedPiiNotice")}
            </div>

            {/* Table of Guests */}
            <div className="border border-hairline rounded-[12px] overflow-hidden max-h-60 overflow-y-auto">
              <div className="p-3 bg-surface-soft border-b border-hairline font-mono text-xs font-semibold grid grid-cols-5 gap-2">
                <span>Doc Number</span>
                <span>Unit</span>
                <span>Name</span>
                <span>Nationality</span>
                <span>ID / Passport</span>
              </div>
              <div className="divide-y divide-hairline font-mono text-xs">
                {displayedRegulatoryRows.map((r) => (
                  <div
                    key={r.occupantId}
                    className="p-3 grid grid-cols-5 gap-2 items-center"
                  >
                    <span className="text-mute">{r.sourceDocumentNumber}</span>
                    <span className="font-semibold">{r.unitNumber}</span>
                    <span className="truncate">{r.fullName}</span>
                    <Badge variant="outline" className="w-fit text-[10px]">
                      {r.nationalityCode}
                    </Badge>
                    <span className="text-mute">
                      {isPiiUnmasked
                        ? r.identityNumber
                        : r.identityNumber.slice(0, 3) +
                          "-XXXX-" +
                          r.identityNumber.slice(-3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CSV Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-rounded font-semibold text-xs text-ink">
                  {tStays("previewCsvTitle")}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCsv}
                  className="rounded-full text-xs font-mono h-7 px-3"
                >
                  {csvCopied ? tStays("csvCopied") : tStays("copyCsv")}
                </Button>
              </div>
              <div
                data-testid="regulatory-csv-preview"
                className="p-3 bg-surface-soft border border-hairline rounded-[12px] font-mono text-[11px] text-body overflow-x-auto whitespace-pre max-h-32"
              >
                {regulatoryCsvContent}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-hairline">
              <Button
                type="button"
                onClick={() => setIsRegulatoryModalOpen(false)}
                className="rounded-full text-xs h-9 px-6 font-medium"
              >
                {tStays("closeRegulatory")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unmask PII Confirmation */}
      <ConfirmationModal
        isOpen={isConfirmUnmaskOpen}
        onClose={() => setIsConfirmUnmaskOpen(false)}
        onConfirm={() => {
          setIsPiiUnmasked(true);
          setIsConfirmUnmaskOpen(false);
        }}
        title={tStays("confirmUnmaskTitle")}
        message={tStays("confirmUnmaskMessage")}
        confirmText={tStays("confirmUnmaskBtn")}
        cancelText={tCommon("cancel")}
        variant="warning"
      />
    </section>
  );
}
