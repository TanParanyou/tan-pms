"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, InvertedCard, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { SelectPill } from "@/components/ui/select-pill";
import { CommandTag } from "@/components/ui/command-tag";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { DeferredFilePicker } from "@/components/ui/deferred-file-picker";
import { useDeferredFileUpload } from "@/hooks/use-deferred-file-upload";
import { useFormTabErrors } from "@/hooks/use-form-tab-errors";
import { useAppLocale } from "@/components/shared/locale-provider";
import type { RoomRackItemDto } from "@/generated/api";

// Mock projection data adhering to ZERO frontend foreign key resolution contract
const INITIAL_ROOM_RACK_DATA: RoomRackItemDto[] = [
  {
    unit: {
      id: "u-101",
      unitNumber: "A-101",
      buildingName: "Building A",
      floorNumber: 1,
      unitTypeName: "Studio Deluxe (28 sqm)",
    },
    occupancyStatus: "Vacant",
    conditionStatus: "Clean",
    supportedStayModes: ["Hourly", "Daily"],
    activeStayMode: null,
    activeDocumentNumber: null,
    customer: undefined,
    remainingMinutes: null,
  },
  {
    unit: {
      id: "u-201",
      unitNumber: "A-201",
      buildingName: "Building A",
      floorNumber: 2,
      unitTypeName: "Standard 1-Bed (32 sqm)",
    },
    occupancyStatus: "Occupied",
    conditionStatus: "Clean",
    supportedStayModes: ["Hourly", "Daily", "Monthly"],
    activeStayMode: "Hourly",
    activeDocumentNumber: "BKK01-STY-2611-0021",
    customer: {
      id: "c-001",
      fullName: "Somchai Prasert",
      maskedNationalId: "1-xxxx-xxxxx-42-9",
    },
    remainingMinutes: 42,
  },
  {
    unit: {
      id: "u-301",
      unitNumber: "A-301",
      buildingName: "Building A",
      floorNumber: 3,
      unitTypeName: "Standard 1-Bed (32 sqm)",
    },
    occupancyStatus: "Occupied",
    conditionStatus: "Clean",
    supportedStayModes: ["Monthly"],
    activeStayMode: "Monthly",
    activeDocumentNumber: "BKK01-LSE-2611-0015",
    customer: {
      id: "c-002",
      fullName: "Wipaporn Kittisak",
      maskedNationalId: "3-xxxx-xxxxx-11-8",
    },
    remainingMinutes: null,
  },
  {
    unit: {
      id: "u-302",
      unitNumber: "A-302",
      buildingName: "Building A",
      floorNumber: 3,
      unitTypeName: "Standard 1-Bed (32 sqm)",
    },
    occupancyStatus: "Vacant",
    conditionStatus: "Dirty",
    supportedStayModes: ["Hourly", "Daily"],
    activeStayMode: null,
    activeDocumentNumber: null,
    customer: undefined,
    remainingMinutes: null,
  },
];

interface MeterRowState {
  unitId: string;
  unitNumber: string;
  previousWater: number;
  currentWater: string;
  previousElectric: number;
  currentElectric: string;
  isRolloverConfirmed: boolean;
}

const INITIAL_METERS: MeterRowState[] = [
  {
    unitId: "u-101",
    unitNumber: "A-101",
    previousWater: 1420,
    currentWater: "1438",
    previousElectric: 8940,
    currentElectric: "9120",
    isRolloverConfirmed: false,
  },
  {
    unitId: "u-201",
    unitNumber: "A-201",
    previousWater: 2150,
    currentWater: "2172",
    previousElectric: 11200,
    currentElectric: "11410",
    isRolloverConfirmed: false,
  },
  {
    unitId: "u-301",
    unitNumber: "A-301",
    previousWater: 3040,
    currentWater: "3020", // Triggers Rollover condition (current < previous)!
    previousElectric: 14500,
    currentElectric: "14850",
    isRolloverConfirmed: false,
  },
];

export default function AdminPage() {
  const { messages, locale, toggleLocale } = useAppLocale();
  const [selectedProperty, setSelectedProperty] = useState("BKK01");
  const [stayModeFilter, setStayModeFilter] = useState<string>("All");
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [meterRows, setMeterRows] = useState<MeterRowState[]>(INITIAL_METERS);
  const [meterSaveNotice, setMeterSaveNotice] = useState<string | null>(null);

  // Cashier Drawer state
  const [cashierShiftNumber] = useState("BKK01-SHF-2611-0004");
  const [slipVerified, setSlipVerified] = useState<"pending" | "approved" | "rejected">("pending");

  // Check-in modal form & validation state
  const [guestName, setGuestName] = useState("");
  const [guestId, setGuestId] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("A-101");
  const [checkInStayMode, setCheckInStayMode] = useState<"Hourly" | "Daily" | "Monthly">("Hourly");
  const [keyDeposit, setKeyDeposit] = useState("500.00");
  const [overrideDirty, setOverrideDirty] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Enterprise Hook: useDeferredFileUpload
  const {
    queuedFiles,
    stageFiles,
    removeFile,
    commitUploads,
    isUploading: isFileUploading,
  } = useDeferredFileUpload({ maxFiles: 3 });

  // Tab validation error simulation
  const formErrors = useMemo(() => {
    if (!formSubmitted) return {};
    const errs: Record<string, string> = {};
    if (!guestName.trim()) errs["guestName"] = "Name required";
    if (!guestId.trim()) errs["guestId"] = "ID required";
    if (overrideDirty && !overrideReason.trim()) {
      errs["overrideReason"] = "Reason required for override";
    }
    return errs;
  }, [formSubmitted, guestName, guestId, overrideDirty, overrideReason]);

  const fieldToTabMap = {
    guestName: "tab-guest",
    guestId: "tab-guest",
    overrideReason: "tab-room",
  };

  const { hasTabError } = useFormTabErrors({
    fieldToTabMap,
    errors: formErrors,
  });

  // Filtered room rack
  const filteredRack = useMemo(() => {
    if (stayModeFilter === "All") return INITIAL_ROOM_RACK_DATA;
    return INITIAL_ROOM_RACK_DATA.filter(
      (item) =>
        item.activeStayMode === stayModeFilter ||
        item.supportedStayModes.includes(stayModeFilter as "Hourly" | "Daily" | "Monthly")
    );
  }, [stayModeFilter]);

  // Handle meter reading change
  const handleMeterChange = (index: number, field: "currentWater" | "currentElectric", value: string) => {
    setMeterRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const toggleRollover = (index: number) => {
    setMeterRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], isRolloverConfirmed: !copy[index].isRolloverConfirmed };
      return copy;
    });
  };

  // Submit check-in with deferred upload
  const handleCompleteCheckIn = async () => {
    setFormSubmitted(true);
    if (!guestName.trim() || !guestId.trim() || (overrideDirty && !overrideReason.trim())) {
      return;
    }

    try {
      // Deferred upload committed on submit
      await commitUploads(async (file) => {
        return `https://storage.tan-pms.internal/checkins/${file.name}`;
      });
      alert("Check-in successful! Document: BKK01-STY-2611-0022");
      setShowCheckInModal(false);
      setFormSubmitted(false);
    } catch {
      alert("Upload failed");
    }
  };

  // FormTabs definition
  const modalTabs: FormTabItem[] = [
    {
      id: "tab-guest",
      label: messages.admin.checkInModal.tabGuest,
      hasError: hasTabError("tab-guest"),
      content: (
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="guestName" className="text-xs">
              {messages.terms.Customer} ({messages.common.required})
            </Label>
            <Input
              id="guestName"
              placeholder="e.g. Somsak Jaidee"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="h-10 text-sm"
            />
            {formSubmitted && !guestName && (
              <span className="text-[11px] text-[#ff5f56]">กรุณาระบุชื่อผู้เข้าพัก</span>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="guestId" className="text-xs">
              เลขประจำตัวประชาชน / พาสปอร์ต ({messages.common.required})
            </Label>
            <Input
              id="guestId"
              placeholder="1-xxxx-xxxxx-xx-x"
              value={guestId}
              onChange={(e) => setGuestId(e.target.value)}
              className="h-10 text-sm font-mono"
            />
            {formSubmitted && !guestId && (
              <span className="text-[11px] text-[#ff5f56]">กรุณาระบุเลขบัตรประชาชน</span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "tab-room",
      label: messages.admin.checkInModal.tabRoom,
      hasError: hasTabError("tab-room"),
      content: (
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">{messages.terms.Unit}</Label>
            <SelectPill value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
              <option value="A-101">A-101 (Studio Deluxe - Clean)</option>
              <option value="A-302">A-302 (Standard 1-Bed - Dirty)</option>
            </SelectPill>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{messages.terms.StayMode}</Label>
            <SelectPill
              value={checkInStayMode}
              onChange={(e) => setCheckInStayMode(e.target.value as "Hourly" | "Daily" | "Monthly")}
            >
              <option value="Hourly">Hourly (รายชั่วโมง)</option>
              <option value="Daily">Daily (รายวัน)</option>
              <option value="Monthly">Monthly (รายเดือน)</option>
            </SelectPill>
          </div>
          {selectedUnit === "A-302" && (
            <div className="rounded-[8px] border border-[#ffbd2e] bg-[#fffbeb] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="overrideDirty"
                  checked={overrideDirty}
                  onChange={(e) => setOverrideDirty(e.target.checked)}
                  className="rounded text-[#000000]"
                />
                <label htmlFor="overrideDirty" className="text-xs font-medium text-[#92400e]">
                  {messages.admin.checkInModal.overrideDirty}
                </label>
              </div>
              {overrideDirty && (
                <div className="space-y-1">
                  <Label htmlFor="overrideReason" className="text-[11px] text-[#92400e]">
                    {messages.admin.checkInModal.overrideReason}
                  </Label>
                  <Input
                    id="overrideReason"
                    placeholder="e.g. Guest insisted on immediate entry for luggage placement"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="h-9 text-xs border-[#ffbd2e]"
                  />
                  {formSubmitted && !overrideReason && (
                    <span className="text-[11px] text-[#ff5f56]">จำเป็นต้องระบุเหตุผล</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "tab-payment",
      label: messages.admin.checkInModal.tabPayment,
      hasError: false,
      content: (
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="keyDeposit" className="text-xs">
              {messages.admin.checkInModal.keyDeposit} (฿)
            </Label>
            <Input
              id="keyDeposit"
              value={keyDeposit}
              onChange={(e) => setKeyDeposit(e.target.value)}
              className="h-10 text-sm font-mono tabular-nums"
            />
          </div>
          <div className="text-xs text-[#737373]">
            เงินมัดจำกุญแจจะถูกบันทึกแยกใน <span className="font-mono text-[#000000]">DepositLedger</span> โดยไม่ปะปนกับรายได้ค่าห้อง
          </div>
        </div>
      ),
    },
    {
      id: "tab-documents",
      label: messages.admin.checkInModal.tabDocuments,
      hasError: false,
      content: (
        <div className="space-y-3 py-2">
          <DeferredFilePicker
            queuedFiles={queuedFiles}
            onFilesSelected={stageFiles}
            onRemoveFile={removeFile}
            isUploading={isFileUploading}
            label="แนบรูปถ่ายบัตรประชาชน / พาสปอร์ต"
            helperText="ไฟล์จะไม่ถูกอัปโหลดขึ้นเซิร์ฟเวอร์จนกว่าจะกดบันทึกเปิดห้อง"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#ffffff] text-[#000000] pb-16">
      {/* 1. Top Command Nav with Property Switcher Pill & StayMode Filter */}
      <header className="sticky top-0 z-30 border-b border-[#e5e5e5] bg-[#ffffff]/90 backdrop-blur-md px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-rounded font-semibold text-xl tracking-tight text-[#000000]">
              tan-pms
            </Link>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#000000] text-[#ffffff] font-mono">
              ADMIN
            </span>

            {/* Property Switcher Pill */}
            <div className="relative">
              <SelectPill
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="h-8 text-xs font-mono font-medium pl-3 pr-8 w-auto min-w-[240px] bg-[#fafafa]"
              >
                <option value="BKK01">BKK01 — TAN Residence Rama 9</option>
                <option value="BKK02">BKK02 — TAN Suites Sukhumvit</option>
                <option value="CNX01">CNX01 — TAN Grand Nimman</option>
              </SelectPill>
            </div>
          </div>

          {/* StayMode Filter Pills & Language Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full bg-[#fafafa] border border-[#e5e5e5] p-1 gap-1">
              {["All", "Hourly", "Daily", "Monthly"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStayModeFilter(mode)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    stayModeFilter === mode
                      ? "bg-[#000000] text-[#ffffff]"
                      : "text-[#737373] hover:text-[#000000]"
                  }`}
                >
                  {mode === "All"
                    ? messages.admin.roomRack.allModes
                    : messages.stayModes[mode as "Hourly" | "Daily" | "Monthly"]}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleLocale}
              className="rounded-full text-xs font-mono h-8"
            >
              🌐 {locale.toUpperCase()}
            </Button>

            <Link href="/login">
              <Button variant="ghost" size="sm" className="rounded-full text-xs h-8">
                {messages.common.logout}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
        {/* Section 2: Exactly ONE InvertedCard (#171717) for Cashier Shift & Quick Drawer */}
        <section aria-label="Cashier Shift Operations">
          <InvertedCard className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#333333] pb-4 mb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f] inline-block animate-pulse" />
                  <span className="text-xs uppercase tracking-wider text-[#a3a3a3] font-mono">
                    {messages.admin.cashier.activeShift}
                  </span>
                  <CommandTag prefixCode="SHF" className="bg-[#262626] border-[#333333] text-[#ffffff]">
                    {cashierShiftNumber}
                  </CommandTag>
                </div>
                <h2 className="text-xl font-rounded font-semibold text-[#ffffff]" data-inverted-heading>
                  {messages.admin.cashier.title}
                </h2>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[11px] text-[#a3a3a3] block">{messages.admin.cashier.currentBalance}</span>
                  <span className="font-mono text-xl font-semibold text-[#ffffff] tabular-nums">
                    ฿12,450.00
                  </span>
                </div>
                <Button
                  variant="onDark"
                  size="sm"
                  onClick={() => setShowCheckInModal(true)}
                  className="rounded-full font-medium"
                >
                  + {messages.admin.cashier.quickWalkIn}
                </Button>
              </div>
            </div>

            {/* Slip Verification Queue inside the InvertedCard */}
            <div className="rounded-[8px] bg-[#222222] border border-[#333333] p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-lg">🧾</span>
                <div>
                  <span className="text-xs font-mono text-[#ffffff] block">
                    Queue: RES-2611-0108 (Slip Transfer ฿1,500.00)
                  </span>
                  <span className="text-[11px] text-[#a3a3a3]">
                    Customer: Thanaporn Somdee • SCB Transfer 14:48
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {slipVerified === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => setSlipVerified("approved")}
                      className="rounded-full bg-[#27c93f] text-[#ffffff] hover:bg-[#20a333] h-8 text-xs font-medium"
                    >
                      ✓ {messages.admin.cashier.verifyApprove}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSlipVerified("rejected")}
                      className="rounded-full bg-transparent text-[#ffffff] border-[#444444] hover:bg-[#333333] h-8 text-xs font-medium"
                    >
                      ✕ {messages.admin.cashier.verifyReject}
                    </Button>
                  </>
                ) : (
                  <Badge variant={slipVerified === "approved" ? "success" : "destructive"}>
                    {slipVerified === "approved" ? "Approved" : "Rejected"}
                  </Badge>
                )}
              </div>
            </div>
          </InvertedCard>
        </section>

        {/* Section 3: Unified Room Rack showing Structured Projection data */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-rounded font-medium text-[#000000]">
                {messages.admin.roomRack.title}
              </h2>
              <p className="text-xs text-[#737373]">
                {messages.admin.roomRack.description}
              </p>
            </div>
            <Button
              onClick={() => setShowCheckInModal(true)}
              size="sm"
              className="rounded-full"
            >
              + {messages.admin.roomRack.quickCheckIn}
            </Button>
          </div>

          {/* Room Rack Table */}
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">{messages.admin.roomRack.unit}</TableHead>
                <TableHead className="w-[140px]">{messages.admin.roomRack.building}</TableHead>
                <TableHead className="w-[180px]">{messages.admin.roomRack.type}</TableHead>
                <TableHead className="w-[130px]">{messages.admin.roomRack.occupancy}</TableHead>
                <TableHead className="w-[140px]">{messages.admin.roomRack.condition}</TableHead>
                <TableHead className="w-[180px]">{messages.admin.roomRack.customer}</TableHead>
                <TableHead className="w-[180px]">{messages.admin.roomRack.document}</TableHead>
                <TableHead className="w-[100px] text-right">{messages.admin.roomRack.unitActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRack.map((row) => (
                <TableRow key={row.unit.id}>
                  <TableCell className="font-mono font-semibold text-[#000000]">
                    {row.unit.unitNumber}
                  </TableCell>
                  <TableCell className="text-xs text-[#737373]">
                    {row.unit.buildingName} • Fl {row.unit.floorNumber}
                  </TableCell>
                  <TableCell className="text-xs text-[#000000]">
                    {row.unit.unitTypeName}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.occupancyStatus === "Vacant"
                          ? "outline"
                          : row.occupancyStatus === "Occupied"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {messages.occupancyStatus[row.occupancyStatus as keyof typeof messages.occupancyStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.conditionStatus === "Clean"
                          ? "success"
                          : row.conditionStatus === "Dirty"
                          ? "destructive"
                          : "warning"
                      }
                    >
                      {messages.conditionStatus[row.conditionStatus as keyof typeof messages.conditionStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.customer ? (
                      <div>
                        <span className="text-xs font-medium block text-[#000000]">
                          {row.customer.fullName}
                        </span>
                        <span className="text-[11px] font-mono text-[#737373] tabular-nums">
                          {row.customer.maskedNationalId}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#a3a3a3]">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.activeDocumentNumber ? (
                      <CommandTag className="text-xs">
                        {row.activeDocumentNumber}
                      </CommandTag>
                    ) : (
                      <span className="text-xs text-[#a3a3a3]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCheckInModal(true)}
                      className="rounded-full h-7 px-3 text-[11px]"
                    >
                      {row.occupancyStatus === "Vacant" ? "Check-in" : "Details"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        {/* Section 4: Zero-Layout-Shift Bulk Utility Meter Reading (PM-07) */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-rounded font-medium text-[#000000]">
                {messages.admin.meters.title}
              </h2>
              <p className="text-xs text-[#737373]">
                {messages.admin.meters.description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMeterSaveNotice("Saved batch meter readings successfully")}
                className="rounded-full"
              >
                💾 {messages.admin.meters.saveBatch}
              </Button>
              <Button
                size="sm"
                onClick={() => alert("Batch Invoice Run initiated for Building A")}
                className="rounded-full"
              >
                ⚡ {messages.admin.meters.batchInvoice}
              </Button>
            </div>
          </div>

          {meterSaveNotice && (
            <div className="rounded-[8px] bg-[#f0fdf4] border border-[#27c93f] p-3 text-xs text-[#166534] flex items-center justify-between">
              <span>{meterSaveNotice}</span>
              <button
                type="button"
                onClick={() => setMeterSaveNotice(null)}
                className="font-bold text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* Zero Layout Shift Table (table-fixed + tabular-nums) */}
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Unit</TableHead>
                <TableHead className="w-[120px]">{messages.admin.meters.previous} (Water)</TableHead>
                <TableHead className="w-[140px]">{messages.admin.meters.current} (Water)</TableHead>
                <TableHead className="w-[110px] text-right">{messages.admin.meters.usage} (Water)</TableHead>
                <TableHead className="w-[120px]">{messages.admin.meters.previous} (Elec)</TableHead>
                <TableHead className="w-[140px]">{messages.admin.meters.current} (Elec)</TableHead>
                <TableHead className="w-[110px] text-right">{messages.admin.meters.usage} (Elec)</TableHead>
                <TableHead className="w-[180px]">Rollover Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meterRows.map((row, idx) => {
                const currentWaterNum = parseFloat(row.currentWater) || 0;
                const waterUsage = currentWaterNum >= row.previousWater
                  ? currentWaterNum - row.previousWater
                  : row.isRolloverConfirmed
                  ? (currentWaterNum + 10000) - row.previousWater
                  : null;

                const currentElecNum = parseFloat(row.currentElectric) || 0;
                const elecUsage = currentElecNum >= row.previousElectric
                  ? currentElecNum - row.previousElectric
                  : currentElecNum - row.previousElectric;

                const isRolloverDetected = currentWaterNum < row.previousWater;

                return (
                  <TableRow key={row.unitId}>
                    <TableCell className="font-mono font-semibold text-[#000000]">
                      {row.unitNumber}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-[#737373]">
                      {row.previousWater.toFixed(1)}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.currentWater}
                        onChange={(e) => handleMeterChange(idx, "currentWater", e.target.value)}
                        className={`h-8 px-3 font-mono text-xs tabular-nums ${
                          isRolloverDetected && !row.isRolloverConfirmed
                            ? "border-[#ff5f56] text-[#ff5f56]"
                            : ""
                        }`}
                      />
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-right font-medium text-[#000000]">
                      {waterUsage !== null ? `${waterUsage.toFixed(1)} m³` : "ERR"}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-[#737373]">
                      {row.previousElectric.toFixed(0)}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.currentElectric}
                        onChange={(e) => handleMeterChange(idx, "currentElectric", e.target.value)}
                        className="h-8 px-3 font-mono text-xs tabular-nums"
                      />
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-right font-medium text-[#000000]">
                      {`${elecUsage.toFixed(0)} kWh`}
                    </TableCell>
                    <TableCell>
                      {isRolloverDetected ? (
                        row.isRolloverConfirmed ? (
                          <Badge variant="success" className="text-[10px]">
                            ✓ Rollover Confirmed
                          </Badge>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => toggleRollover(idx)}
                            className="rounded-full h-7 px-3 text-[11px] animate-pulse"
                          >
                            ⚠️ Confirm Rollover
                          </Button>
                        )
                      ) : (
                        <span className="text-[11px] text-[#a3a3a3]">Normal</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>

        {/* Section 5: Modal for Check-in / Lease Creation with FormTabs */}
        {showCheckInModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/40 backdrop-blur-sm p-4">
            <Card className="w-full max-w-xl rounded-[12px] bg-[#ffffff] border border-[#e5e5e5] p-6 shadow-2xl">
              <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between border-b border-[#e5e5e5]">
                <CardTitle className="text-xl font-rounded">
                  {messages.admin.checkInModal.title}
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="rounded-full text-[#737373] hover:text-[#000000] p-1 font-bold"
                >
                  ✕
                </button>
              </CardHeader>

              <CardContent className="p-0 pt-4 space-y-4">
                <FormTabs tabs={modalTabs} defaultValue="tab-guest" />

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#e5e5e5]">
                  <Button
                    variant="outline"
                    onClick={() => setShowCheckInModal(false)}
                    className="rounded-full"
                  >
                    {messages.common.cancel}
                  </Button>
                  <Button
                    onClick={handleCompleteCheckIn}
                    disabled={isFileUploading}
                    className="rounded-full bg-[#000000] text-[#ffffff]"
                  >
                    {isFileUploading ? messages.common.loading : messages.admin.checkInModal.completeCheckIn}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
