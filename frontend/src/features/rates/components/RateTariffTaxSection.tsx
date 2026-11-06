"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CommandTag } from "@/components/ui/command-tag";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import {
  INITIAL_RATE_PLANS,
  INITIAL_UTILITY_TARIFFS,
  INITIAL_TAX_PROFILES,
  SAMPLE_UNIT_TYPE_REFS,
} from "../constants";
import type {
  RatePlanItemDto,
  UtilityTariffItemDto,
  TaxProfileItemDto,
  RateCatalogTabKey,
  StayModeType,
  UtilityBillingModeType,
  ThaiTaxModeType,
} from "../types";
import {
  calculateHourlySimulationQuote,
  calculateUtilitySimulationQuote,
  calculateTaxSimulationQuote,
} from "../utils/calculators";

export interface RateTariffTaxSectionProps {
  initialRatePlans?: RatePlanItemDto[];
  initialUtilityTariffs?: UtilityTariffItemDto[];
  initialTaxProfiles?: TaxProfileItemDto[];
}

export function RateTariffTaxSection({
  initialRatePlans = INITIAL_RATE_PLANS,
  initialUtilityTariffs = INITIAL_UTILITY_TARIFFS,
  initialTaxProfiles = INITIAL_TAX_PROFILES,
}: RateTariffTaxSectionProps) {
  const locale = useLocale() as "th" | "en";
  const tRates = useTranslations("admin.rates");
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");

  // Main Category Tab State
  const [activeCatalogTab, setActiveCatalogTab] =
    useState<RateCatalogTabKey>("rate-plans");

  // In-memory data states
  const [ratePlans, setRatePlans] =
    useState<RatePlanItemDto[]>(initialRatePlans);
  const [utilityTariffs, setUtilityTariffs] =
    useState<UtilityTariffItemDto[]>(initialUtilityTariffs);
  const [taxProfiles, setTaxProfiles] =
    useState<TaxProfileItemDto[]>(initialTaxProfiles);

  // Filters for Rate Plans
  const [rateSearchQuery, setRateSearchQuery] = useState("");
  const [stayModeFilter, setStayModeFilter] = useState("All");

  // Modals visibility
  const [isRatePlanModalOpen, setIsRatePlanModalOpen] = useState(false);
  const [editingRatePlanId, setEditingRatePlanId] = useState<string | null>(
    null
  );
  const [isTariffModalOpen, setIsTariffModalOpen] = useState(false);
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [editingTaxId, setEditingTaxId] = useState<string | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Confirmation modal states
  const [isConfirmRateOpen, setIsConfirmRateOpen] = useState(false);
  const [isConfirmTariffOpen, setIsConfirmTariffOpen] = useState(false);
  const [isConfirmTaxOpen, setIsConfirmTaxOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Rate Plan Form State ---
  const [formRpCode, setFormRpCode] = useState("");
  const [formRpNameTh, setFormRpNameTh] = useState("");
  const [formRpNameEn, setFormRpNameEn] = useState("");
  const [formRpUnitTypeId, setFormRpUnitTypeId] = useState(
    SAMPLE_UNIT_TYPE_REFS[0].id
  );
  const [formRpStayModes, setFormRpStayModes] = useState<StayModeType[]>([
    "Hourly",
    "Daily",
    "Monthly",
  ]);
  const [formRpIsActive, setFormRpIsActive] = useState(true);
  const [formBaseHours, setFormBaseHours] = useState(3);
  const [formBasePrice, setFormBasePrice] = useState(450);
  const [formAddHourPrice, setFormAddHourPrice] = useState(120);
  const [formGraceMinutes, setFormGraceMinutes] = useState(15);
  const [formAutoCapDaily, setFormAutoCapDaily] = useState(1200);
  const [formBufferMinutes, setFormBufferMinutes] = useState(30);
  const [formWeekdayRate, setFormWeekdayRate] = useState(890);
  const [formWeekendRate, setFormWeekendRate] = useState(1090);
  const [formHolidaySurcharge, setFormHolidaySurcharge] = useState(200);
  const [formExtraGuestPrice, setFormExtraGuestPrice] = useState(250);
  const [formMonthlyRent, setFormMonthlyRent] = useState(8500);
  const [formMinLeaseMonths, setFormMinLeaseMonths] = useState(6);
  const [formDepositMonths, setFormDepositMonths] = useState(2);
  const [activeRateFormTab, setActiveRateFormTab] = useState("tab-basic");

  // --- Utility Tariff Form State ---
  const [formTariffBillingMode, setFormTariffBillingMode] =
    useState<UtilityBillingModeType>("PerUnit");
  const [formTariffRatePerUnit, setFormTariffRatePerUnit] = useState(18);
  const [formTariffMinCharge, setFormTariffMinCharge] = useState(100);
  const [formTariffIncludedUnits, setFormTariffIncludedUnits] = useState(0);
  const [formTariffBaseMinAmount, setFormTariffBaseMinAmount] = useState(0);
  const [formTariffFlatAmount, setFormTariffFlatAmount] = useState(0);
  const [formTariffPerOccupant, setFormTariffPerOccupant] = useState(false);
  const [formTariffMaxDigits, setFormTariffMaxDigits] = useState(4);

  // --- Tax Profile Form State ---
  const [formTaxCategoryCode, setFormTaxCategoryCode] = useState("");
  const [formTaxNameTh, setFormTaxNameTh] = useState("");
  const [formTaxNameEn, setFormTaxNameEn] = useState("");
  const [formTaxMode, setFormTaxMode] = useState<ThaiTaxModeType>("Exempt");
  const [formTaxVatPercent, setFormTaxVatPercent] = useState(0);
  const [formTaxDefaultWht, setFormTaxDefaultWht] = useState(5);
  const [formTaxIsActive, setFormTaxIsActive] = useState(true);

  // --- Interactive Simulator State ---
  const [simRatePlanId, setSimRatePlanId] = useState<string>(
    initialRatePlans[0]?.id || "rp-01"
  );
  const [simDurationMinutes, setSimDurationMinutes] = useState<number>(195);
  const [simUtilityType, setSimUtilityType] = useState<"Water" | "Electric">(
    "Water"
  );
  const [simPrevReading, setSimPrevReading] = useState<number>(9980);
  const [simCurrReading, setSimCurrReading] = useState<number>(15);
  const [simRolloverConfirmed, setSimRolloverConfirmed] =
    useState<boolean>(false);
  const [simTaxProfileId, setSimTaxProfileId] = useState<string>(
    initialTaxProfiles[1]?.id || "tax-02"
  );
  const [simSampleAmount, setSimSampleAmount] = useState<number>(1000);
  const [simApplyWht, setSimApplyWht] = useState<boolean>(true);

  // Filtered Rate Plans
  const filteredRatePlans = useMemo(() => {
    return ratePlans.filter((plan) => {
      const matchesStayMode =
        stayModeFilter === "All" ||
        plan.supportedStayModes.includes(stayModeFilter as StayModeType);
      const q = rateSearchQuery.toLowerCase().trim();
      const planName = resolveLocalizedText(plan.name, locale).toLowerCase();
      const unitTypeName = resolveLocalizedText(
        plan.unitType.name,
        locale
      ).toLowerCase();
      const matchesQuery =
        !q ||
        plan.code.toLowerCase().includes(q) ||
        planName.includes(q) ||
        plan.unitType.code.toLowerCase().includes(q) ||
        unitTypeName.includes(q);
      return matchesStayMode && matchesQuery;
    });
  }, [ratePlans, stayModeFilter, rateSearchQuery, locale]);

  // Rate Plan Handlers
  const handleOpenCreateRatePlan = () => {
    setEditingRatePlanId(null);
    setFormRpCode(`RP-NEW-${String(Date.now()).slice(-4)}`);
    setFormRpNameTh("");
    setFormRpNameEn("");
    setFormRpUnitTypeId(SAMPLE_UNIT_TYPE_REFS[0].id);
    setFormRpStayModes(["Hourly", "Daily", "Monthly"]);
    setFormRpIsActive(true);
    setFormBaseHours(3);
    setFormBasePrice(450);
    setFormAddHourPrice(120);
    setFormGraceMinutes(15);
    setFormAutoCapDaily(1200);
    setFormBufferMinutes(30);
    setFormWeekdayRate(890);
    setFormWeekendRate(1090);
    setFormHolidaySurcharge(200);
    setFormExtraGuestPrice(250);
    setFormMonthlyRent(8500);
    setFormMinLeaseMonths(6);
    setFormDepositMonths(2);
    setActiveRateFormTab("tab-basic");
    setIsRatePlanModalOpen(true);
  };

  const handleOpenEditRatePlan = (plan: RatePlanItemDto) => {
    setEditingRatePlanId(plan.id);
    setFormRpCode(plan.code);
    setFormRpNameTh(plan.name.th || "");
    setFormRpNameEn(plan.name.en || "");
    setFormRpUnitTypeId(plan.unitType.id);
    setFormRpStayModes([...plan.supportedStayModes]);
    setFormRpIsActive(plan.isActive);
    setFormBaseHours(plan.hourlyPackage.basePackageHours);
    setFormBasePrice(plan.hourlyPackage.basePackagePrice);
    setFormAddHourPrice(plan.hourlyPackage.additionalHourPrice);
    setFormGraceMinutes(plan.hourlyPackage.gracePeriodMinutes);
    setFormAutoCapDaily(plan.hourlyPackage.autoCapToDailyRate);
    setFormBufferMinutes(plan.hourlyPackage.turnaroundBufferMinutes);
    setFormWeekdayRate(plan.dailyRate.weekdayRate);
    setFormWeekendRate(plan.dailyRate.weekendRate);
    setFormHolidaySurcharge(plan.dailyRate.holidaySurchargeAmount);
    setFormExtraGuestPrice(plan.dailyRate.extraGuestPrice);
    setFormMonthlyRent(plan.monthlyRate.monthlyRentRate);
    setFormMinLeaseMonths(plan.monthlyRate.minimumLeaseMonths);
    setFormDepositMonths(plan.monthlyRate.securityDepositMonths);
    setActiveRateFormTab("tab-basic");
    setIsRatePlanModalOpen(true);
  };

  const handleToggleRpStayMode = (mode: StayModeType) => {
    setFormRpStayModes((prev) =>
      prev.includes(mode)
        ? prev.length > 1
          ? prev.filter((m) => m !== mode)
          : prev
        : [...prev, mode]
    );
  };

  const handleSaveRatePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRpCode.trim()) return;
    setIsConfirmRateOpen(true);
  };

  const handleConfirmSaveRatePlan = async () => {
    setIsSubmitting(true);
    try {
      const selectedUnitType =
        SAMPLE_UNIT_TYPE_REFS.find((ut) => ut.id === formRpUnitTypeId) ||
        SAMPLE_UNIT_TYPE_REFS[0];

      const updatedPlan: RatePlanItemDto = {
        id: editingRatePlanId || `rp-${Date.now()}`,
        code: formRpCode.trim(),
        name: {
          th: formRpNameTh.trim() || formRpNameEn.trim(),
          en: formRpNameEn.trim() || formRpNameTh.trim(),
        },
        unitType: {
          id: selectedUnitType.id,
          code: selectedUnitType.code,
          name: { ...selectedUnitType.name },
          areaSqm: selectedUnitType.areaSqm,
        },
        supportedStayModes: [...formRpStayModes],
        hourlyPackage: {
          basePackageHours: Number(formBaseHours) || 3,
          basePackagePrice: Number(formBasePrice) || 0,
          additionalHourPrice: Number(formAddHourPrice) || 0,
          gracePeriodMinutes: Number(formGraceMinutes) || 0,
          autoCapToDailyRate: Number(formAutoCapDaily) || 0,
          turnaroundBufferMinutes: Number(formBufferMinutes) || 0,
        },
        dailyRate: {
          weekdayRate: Number(formWeekdayRate) || 0,
          weekendRate: Number(formWeekendRate) || 0,
          holidaySurchargeAmount: Number(formHolidaySurcharge) || 0,
          extraGuestPrice: Number(formExtraGuestPrice) || 0,
        },
        monthlyRate: {
          monthlyRentRate: Number(formMonthlyRent) || 0,
          minimumLeaseMonths: Number(formMinLeaseMonths) || 1,
          securityDepositMonths: Number(formDepositMonths) || 1,
        },
        isActive: formRpIsActive,
      };

      if (editingRatePlanId) {
        setRatePlans((prev) =>
          prev.map((p) => (p.id === editingRatePlanId ? updatedPlan : p))
        );
      } else {
        setRatePlans((prev) => [updatedPlan, ...prev]);
      }
      setIsConfirmRateOpen(false);
      setIsRatePlanModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Utility Tariff Handlers
  const handleOpenEditTariff = (tariff: UtilityTariffItemDto) => {
    setEditingTariffId(tariff.id);
    setFormTariffBillingMode(tariff.billingMode);
    setFormTariffRatePerUnit(tariff.ratePerUnit);
    setFormTariffMinCharge(tariff.minimumChargeAmount);
    setFormTariffIncludedUnits(tariff.includedUnits);
    setFormTariffBaseMinAmount(tariff.baseMinimumAmount);
    setFormTariffFlatAmount(tariff.flatRateAmount);
    setFormTariffPerOccupant(tariff.flatRatePerOccupant);
    setFormTariffMaxDigits(tariff.meterMaxDigits);
    setIsTariffModalOpen(true);
  };

  const handleSaveTariffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsConfirmTariffOpen(true);
  };

  const handleConfirmSaveTariff = async () => {
    setIsSubmitting(true);
    try {
      if (editingTariffId) {
        setUtilityTariffs((prev) =>
          prev.map((t) =>
            t.id === editingTariffId
              ? {
                  ...t,
                  billingMode: formTariffBillingMode,
                  ratePerUnit: Number(formTariffRatePerUnit) || 0,
                  minimumChargeAmount: Number(formTariffMinCharge) || 0,
                  includedUnits: Number(formTariffIncludedUnits) || 0,
                  baseMinimumAmount: Number(formTariffBaseMinAmount) || 0,
                  flatRateAmount: Number(formTariffFlatAmount) || 0,
                  flatRatePerOccupant: formTariffPerOccupant,
                  meterMaxDigits: Number(formTariffMaxDigits) || 4,
                }
              : t
          )
        );
      }
      setIsConfirmTariffOpen(false);
      setIsTariffModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tax Profile Handlers
  const handleOpenCreateTax = () => {
    setEditingTaxId(null);
    setFormTaxCategoryCode(`CHARGE_${String(Date.now()).slice(-4)}`);
    setFormTaxNameTh("");
    setFormTaxNameEn("");
    setFormTaxMode("VatIncluded");
    setFormTaxVatPercent(7);
    setFormTaxDefaultWht(0);
    setFormTaxIsActive(true);
    setIsTaxModalOpen(true);
  };

  const handleOpenEditTax = (tax: TaxProfileItemDto) => {
    setEditingTaxId(tax.id);
    setFormTaxCategoryCode(tax.chargeCategoryCode);
    setFormTaxNameTh(tax.name.th || "");
    setFormTaxNameEn(tax.name.en || "");
    setFormTaxMode(tax.taxMode);
    setFormTaxVatPercent(tax.vatRatePercent);
    setFormTaxDefaultWht(tax.defaultWithholdingTaxPercent);
    setFormTaxIsActive(tax.isActive);
    setIsTaxModalOpen(true);
  };

  const handleSaveTaxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTaxCategoryCode.trim()) return;
    setIsConfirmTaxOpen(true);
  };

  const handleConfirmSaveTax = async () => {
    setIsSubmitting(true);
    try {
      const updatedTax: TaxProfileItemDto = {
        id: editingTaxId || `tax-${Date.now()}`,
        chargeCategoryCode: formTaxCategoryCode.trim(),
        name: {
          th: formTaxNameTh.trim() || formTaxNameEn.trim(),
          en: formTaxNameEn.trim() || formTaxNameTh.trim(),
        },
        taxMode: formTaxMode,
        vatRatePercent: formTaxMode === "Exempt" ? 0 : Number(formTaxVatPercent) || 0,
        defaultWithholdingTaxPercent: Number(formTaxDefaultWht) || 0,
        isActive: formTaxIsActive,
      };

      if (editingTaxId) {
        setTaxProfiles((prev) =>
          prev.map((tp) => (tp.id === editingTaxId ? updatedTax : tp))
        );
      } else {
        setTaxProfiles((prev) => [...prev, updatedTax]);
      }
      setIsConfirmTaxOpen(false);
      setIsTaxModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Real-time Simulator Calculations ---
  const activeSimRatePlan = useMemo(() => {
    return (
      ratePlans.find((rp) => rp.id === simRatePlanId) ||
      ratePlans[0] ||
      INITIAL_RATE_PLANS[0]
    );
  }, [ratePlans, simRatePlanId]);

  const activeSimTariff = useMemo(() => {
    return (
      utilityTariffs.find((ut) => ut.utilityType === simUtilityType) ||
      utilityTariffs[0] ||
      INITIAL_UTILITY_TARIFFS[0]
    );
  }, [utilityTariffs, simUtilityType]);

  const activeSimTaxProfile = useMemo(() => {
    return (
      taxProfiles.find((tp) => tp.id === simTaxProfileId) ||
      taxProfiles[0] ||
      INITIAL_TAX_PROFILES[0]
    );
  }, [taxProfiles, simTaxProfileId]);

  const simHourlyQuote = useMemo(() => {
    return calculateHourlySimulationQuote(
      simDurationMinutes,
      activeSimRatePlan.hourlyPackage
    );
  }, [simDurationMinutes, activeSimRatePlan]);

  const simUtilityQuote = useMemo(() => {
    return calculateUtilitySimulationQuote(
      simUtilityType,
      simPrevReading,
      simCurrReading,
      simRolloverConfirmed,
      activeSimTariff,
      1
    );
  }, [
    simUtilityType,
    simPrevReading,
    simCurrReading,
    simRolloverConfirmed,
    activeSimTariff,
  ]);

  const simTaxQuote = useMemo(() => {
    return calculateTaxSimulationQuote(
      simSampleAmount,
      activeSimTaxProfile,
      simApplyWht
    );
  }, [simSampleAmount, activeSimTaxProfile, simApplyWht]);

  // Rate Plans Columns (Table-Preserved)
  const ratePlanColumns: ColumnDef<RatePlanItemDto>[] = [
    {
      id: "codeAndName",
      header: tRates("colCodeName"),
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs font-semibold text-ink">
            {row.code}
          </span>
          <span className="text-xs text-body line-clamp-1">
            {resolveLocalizedText(row.name, locale)}
          </span>
        </div>
      ),
    },
    {
      id: "unitType",
      header: tRates("colUnitType"),
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs text-ink font-medium">
            {row.unitType.code}
          </span>
          <span className="text-xs text-mute">
            {resolveLocalizedText(row.unitType.name, locale)} ({row.unitType.areaSqm} m²)
          </span>
        </div>
      ),
    },
    {
      id: "hourlyPackage",
      header: tRates("colHourlyPackage"),
      cell: (row) => (
        <div className="flex flex-col gap-0.5 text-xs font-mono tabular-nums text-ink">
          <div className="font-semibold text-primary">
            {row.hourlyPackage.basePackageHours}h = THB{" "}
            {row.hourlyPackage.basePackagePrice.toLocaleString()}
          </div>
          <div className="text-mute text-[11px]">
            +{row.hourlyPackage.additionalHourPrice} THB/h • Grace{" "}
            {row.hourlyPackage.gracePeriodMinutes}m • Cap THB{" "}
            {row.hourlyPackage.autoCapToDailyRate.toLocaleString()}
          </div>
        </div>
      ),
    },
    {
      id: "dailyMonthly",
      header: tRates("colDailyMonthly"),
      cell: (row) => (
        <div className="flex flex-col gap-0.5 text-xs font-mono tabular-nums text-ink">
          <div>
            THB {row.dailyRate.weekdayRate.toLocaleString()} / THB{" "}
            {row.dailyRate.weekendRate.toLocaleString()}
          </div>
          <div className="text-mute text-[11px]">
            THB {row.monthlyRate.monthlyRentRate.toLocaleString()}/mo (Dep{" "}
            {row.monthlyRate.securityDepositMonths}m)
          </div>
        </div>
      ),
    },
    {
      id: "statusModes",
      header: tRates("colStatusModes"),
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant={row.isActive ? "default" : "outline"}
            className="rounded-full text-[10px] px-2 py-0.5"
          >
            {row.isActive ? tRates("statusActive") : tRates("statusInactive")}
          </Badge>
          {row.supportedStayModes.map((mode) => (
            <Badge
              key={mode}
              variant="outline"
              className="rounded-full text-[10px] font-mono px-1.5 py-0.5 bg-surface-soft"
            >
              {tModes(mode)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: "actions",
      header: tRates("colActions"),
      className: "text-right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenEditRatePlan(row)}
            className="rounded-full text-xs h-7 px-3"
          >
            {tRates("actionEdit")}
          </Button>
        </div>
      ),
    },
  ];

  // Utility Tariffs Columns
  const utilityColumns: ColumnDef<UtilityTariffItemDto>[] = [
    {
      id: "utilityType",
      header: tRates("colUtilityType"),
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Badge
            variant={row.utilityType === "Water" ? "outline" : "default"}
            className="rounded-full font-mono text-xs px-2.5 py-0.5"
          >
            {row.utilityType === "Water"
              ? tRates("waterType")
              : tRates("electricType")}
          </Badge>
          <span className="text-xs text-body line-clamp-1">
            {resolveLocalizedText(row.name, locale)}
          </span>
        </div>
      ),
    },
    {
      id: "billingMode",
      header: tRates("colBillingMode"),
      cell: (row) => (
        <span className="font-mono text-xs font-medium text-ink">
          {row.billingMode}
        </span>
      ),
    },
    {
      id: "rates",
      header: tRates("colRates"),
      cell: (row) => (
        <div className="flex flex-col gap-0.5 text-xs font-mono tabular-nums text-ink">
          {row.billingMode === "PerUnit" && (
            <span>
              {row.ratePerUnit} THB/unit (Min {row.minimumChargeAmount} THB)
            </span>
          )}
          {row.billingMode === "MinimumUnits" && (
            <span>
              Base {row.baseMinimumAmount} THB (incl. {row.includedUnits} units, extra +{row.ratePerUnit} THB)
            </span>
          )}
          {row.billingMode === "FlatRate" && (
            <span>
              {row.flatRateAmount} THB flat {row.flatRatePerOccupant ? "/occupant" : "/room"}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "meterDigits",
      header: tRates("colMeterDigits"),
      cell: (row) => (
        <span className="font-mono text-xs text-body">
          {row.meterMaxDigits} digits (10^{row.meterMaxDigits})
        </span>
      ),
    },
    {
      id: "actions",
      header: tRates("colActions"),
      className: "text-right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenEditTariff(row)}
            className="rounded-full text-xs h-7 px-3"
          >
            {tRates("actionEdit")}
          </Button>
        </div>
      ),
    },
  ];

  // Tax Profiles Columns
  const taxColumns: ColumnDef<TaxProfileItemDto>[] = [
    {
      id: "chargeCategory",
      header: tRates("colChargeCategory"),
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs font-semibold text-ink">
            {row.chargeCategoryCode}
          </span>
          <span className="text-xs text-body line-clamp-1">
            {resolveLocalizedText(row.name, locale)}
          </span>
        </div>
      ),
    },
    {
      id: "taxMode",
      header: tRates("colTaxMode"),
      cell: (row) => {
        let badgeVariant: "default" | "outline" | "secondary" = "outline";
        if (row.taxMode === "VatIncluded") badgeVariant = "default";
        return (
          <Badge
            variant={badgeVariant}
            className="rounded-full font-mono text-xs px-2.5 py-0.5"
          >
            {row.taxMode}
          </Badge>
        );
      },
    },
    {
      id: "vatRate",
      header: tRates("colVatRate"),
      cell: (row) => (
        <span className="font-mono text-xs font-medium text-ink">
          {row.vatRatePercent}%
        </span>
      ),
    },
    {
      id: "whtRate",
      header: tRates("colWhtRate"),
      cell: (row) => (
        <span className="font-mono text-xs text-body">
          {row.defaultWithholdingTaxPercent}%
        </span>
      ),
    },
    {
      id: "status",
      header: tRates("colStatusModes"),
      cell: (row) => (
        <Badge
          variant={row.isActive ? "default" : "outline"}
          className="rounded-full text-[10px] px-2 py-0.5"
        >
          {row.isActive ? tRates("statusActive") : tRates("statusInactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: tRates("colActions"),
      className: "text-right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenEditTax(row)}
            className="rounded-full text-xs h-7 px-3"
          >
            {tRates("actionEdit")}
          </Button>
        </div>
      ),
    },
  ];

  // Rate Plan Form Tabs
  const rateFormTabs: FormTabItem[] = [
    {
      id: "tab-basic",
      label: tRates("formTabBasic"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldCode")}
              </Label>
              <Input
                value={formRpCode}
                onChange={(e) => setFormRpCode(e.target.value)}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldUnitType")}
              </Label>
              <SelectPill
                value={formRpUnitTypeId}
                onChange={(e) => setFormRpUnitTypeId(e.target.value)}
                className="h-10 text-xs"
              >
                {SAMPLE_UNIT_TYPE_REFS.map((ut) => (
                  <option key={ut.id} value={ut.id}>
                    {ut.code} — {resolveLocalizedText(ut.name, locale)} ({ut.areaSqm} m²)
                  </option>
                ))}
              </SelectPill>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldNameTh")}
              </Label>
              <Input
                value={formRpNameTh}
                onChange={(e) => setFormRpNameTh(e.target.value)}
                className="h-10 rounded-full text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldNameEn")}
              </Label>
              <Input
                value={formRpNameEn}
                onChange={(e) => setFormRpNameEn(e.target.value)}
                className="h-10 rounded-full text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-ink">
              {tRates("fieldSupportedModes")}
            </Label>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {(["Hourly", "Daily", "Monthly"] as StayModeType[]).map((mode) => {
                const isSelected = formRpStayModes.includes(mode);
                return (
                  <Button
                    key={mode}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToggleRpStayMode(mode)}
                    className="rounded-full text-xs font-mono h-8 px-4"
                  >
                    {tModes(mode)}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant={formRpIsActive ? "default" : "outline"}
              size="sm"
              onClick={() => setFormRpIsActive(!formRpIsActive)}
              className="rounded-full text-xs h-8 px-4"
            >
              {formRpIsActive ? tRates("statusActive") : tRates("statusInactive")}
            </Button>
          </div>
        </div>
      ),
    },
    {
      id: "tab-hourly",
      label: tRates("formTabHourly"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldBasePackageHours")}
              </Label>
              <Input
                type="number"
                value={formBaseHours}
                onChange={(e) => setFormBaseHours(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldBasePackagePrice")}
              </Label>
              <Input
                type="number"
                value={formBasePrice}
                onChange={(e) => setFormBasePrice(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldAdditionalHourPrice")}
              </Label>
              <Input
                type="number"
                value={formAddHourPrice}
                onChange={(e) => setFormAddHourPrice(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldGracePeriodMinutes")}
              </Label>
              <Input
                type="number"
                value={formGraceMinutes}
                onChange={(e) => setFormGraceMinutes(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldAutoCapToDailyRate")}
              </Label>
              <Input
                type="number"
                value={formAutoCapDaily}
                onChange={(e) => setFormAutoCapDaily(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldTurnaroundBufferMinutes")}
              </Label>
              <Input
                type="number"
                value={formBufferMinutes}
                onChange={(e) => setFormBufferMinutes(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "tab-daily-monthly",
      label: tRates("formTabDailyMonthly"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldWeekdayRate")}
              </Label>
              <Input
                type="number"
                value={formWeekdayRate}
                onChange={(e) => setFormWeekdayRate(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldWeekendRate")}
              </Label>
              <Input
                type="number"
                value={formWeekendRate}
                onChange={(e) => setFormWeekendRate(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldHolidaySurchargeAmount")}
              </Label>
              <Input
                type="number"
                value={formHolidaySurcharge}
                onChange={(e) => setFormHolidaySurcharge(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldExtraGuestPrice")}
              </Label>
              <Input
                type="number"
                value={formExtraGuestPrice}
                onChange={(e) => setFormExtraGuestPrice(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-hairline">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldMonthlyRentRate")}
              </Label>
              <Input
                type="number"
                value={formMonthlyRent}
                onChange={(e) => setFormMonthlyRent(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldMinimumLeaseMonths")}
              </Label>
              <Input
                type="number"
                value={formMinLeaseMonths}
                onChange={(e) => setFormMinLeaseMonths(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldSecurityDepositMonths")}
              </Label>
              <Input
                type="number"
                value={formDepositMonths}
                onChange={(e) => setFormDepositMonths(Number(e.target.value))}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
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
            <CommandTag prefixCode="PM-03">PRICING & TAX RULES</CommandTag>
            <Badge
              variant="outline"
              className="rounded-full font-mono text-xs px-2.5 py-0.5 bg-surface-soft"
            >
              {tRates("badgeRatePlans", { count: ratePlans.length })}
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full font-mono text-xs px-2.5 py-0.5 bg-surface-soft"
            >
              {tRates("badgeUtilities", { count: utilityTariffs.length })}
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full font-mono text-xs px-2.5 py-0.5 bg-surface-soft"
            >
              {tRates("badgeTaxProfiles", { count: taxProfiles.length })}
            </Badge>
          </div>
          <h2 className="font-rounded text-xl font-semibold tracking-tight text-ink">
            {tRates("title")}
          </h2>
          <p className="text-xs text-body">{tRates("description")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSimulatorOpen(true)}
            className="rounded-full text-xs font-mono h-9 px-4"
          >
            🧮 {tRates("openSimulator")}
          </Button>

          {activeCatalogTab === "rate-plans" && (
            <Button
              type="button"
              size="sm"
              onClick={handleOpenCreateRatePlan}
              className="rounded-full text-xs h-9 px-4"
            >
              + {tRates("createRatePlan")}
            </Button>
          )}

          {activeCatalogTab === "tax-profiles" && (
            <Button
              type="button"
              size="sm"
              onClick={handleOpenCreateTax}
              className="rounded-full text-xs h-9 px-4"
            >
              + {tRates("createTax")}
            </Button>
          )}
        </div>
      </div>

      {/* 2. Main Content Card (Ollama Minimal: 12px, border-hairline, bg-canvas, no nested bordered cards) */}
      <div className="rounded-[12px] border border-hairline bg-canvas p-6 shadow-none space-y-6">
        {/* View Switcher Pills */}
        <div className="flex items-center rounded-full bg-surface-soft border border-hairline p-1 gap-1 w-fit">
          <Button
            type="button"
            variant={activeCatalogTab === "rate-plans" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveCatalogTab("rate-plans")}
            className="rounded-full text-xs font-medium h-7 px-4"
          >
            {tRates("tabRatePlans")}
          </Button>
          <Button
            type="button"
            variant={activeCatalogTab === "utility-tariffs" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveCatalogTab("utility-tariffs")}
            className="rounded-full text-xs font-medium h-7 px-4"
          >
            {tRates("tabUtilityTariffs")}
          </Button>
          <Button
            type="button"
            variant={activeCatalogTab === "tax-profiles" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveCatalogTab("tax-profiles")}
            className="rounded-full text-xs font-medium h-7 px-4"
          >
            {tRates("tabTaxProfiles")}
          </Button>
        </div>

        {/* Tab 1: Rate Plans & Hourly Packages */}
        {activeCatalogTab === "rate-plans" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="w-full sm:max-w-md">
                <Input
                  value={rateSearchQuery}
                  onChange={(e) => setRateSearchQuery(e.target.value)}
                  placeholder={tRates("searchPlaceholder")}
                  className="h-10 rounded-full text-xs px-4"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <SelectPill
                  value={stayModeFilter}
                  onChange={(e) => setStayModeFilter(e.target.value)}
                  className="h-10 text-xs w-full sm:w-48"
                >
                  <option value="All">{tRates("filterStayModeAll")}</option>
                  <option value="Hourly">{tModes("Hourly")}</option>
                  <option value="Daily">{tModes("Daily")}</option>
                  <option value="Monthly">{tModes("Monthly")}</option>
                </SelectPill>
              </div>
            </div>

            <DataTable
              columns={ratePlanColumns}
              data={filteredRatePlans}
              emptyTitle={tRates("emptyRatePlans")}
              className="border border-hairline rounded-[12px] overflow-hidden"
            />
          </div>
        )}

        {/* Tab 2: Utility Tariffs */}
        {activeCatalogTab === "utility-tariffs" && (
          <div className="space-y-4">
            <DataTable
              columns={utilityColumns}
              data={utilityTariffs}
              emptyTitle={tRates("emptyUtilities")}
              className="border border-hairline rounded-[12px] overflow-hidden"
            />
          </div>
        )}

        {/* Tab 3: Tax Profiles */}
        {activeCatalogTab === "tax-profiles" && (
          <div className="space-y-4">
            <DataTable
              columns={taxColumns}
              data={taxProfiles}
              emptyTitle={tRates("emptyTaxProfiles")}
              className="border border-hairline rounded-[12px] overflow-hidden"
            />
          </div>
        )}
      </div>

      {/* --- Rate Plan Create/Edit Dialog --- */}
      <Dialog
        open={isRatePlanModalOpen}
        onOpenChange={(open) => {
          if (!open) setIsRatePlanModalOpen(false);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="font-rounded text-lg text-ink">
              {editingRatePlanId
                ? tRates("modalTitleEdit", { code: formRpCode })
                : tRates("modalTitleCreate")}
            </DialogTitle>
            <DialogDescription className="text-xs text-body">
              {tRates("modalDesc")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRatePlanSubmit} className="space-y-6 pt-2">
            <FormTabs
              tabs={rateFormTabs}
              value={activeRateFormTab}
              onValueChange={setActiveRateFormTab}
            />

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-hairline">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsRatePlanModalOpen(false)}
                className="rounded-full text-xs h-9 px-4"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full text-xs h-9 px-6 font-medium"
              >
                {tRates("savePlan")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rate Plan Confirmation */}
      <ConfirmationModal
        isOpen={isConfirmRateOpen}
        onClose={() => setIsConfirmRateOpen(false)}
        onConfirm={handleConfirmSaveRatePlan}
        title={tRates("confirmSavePlanTitle")}
        message={tRates("confirmSavePlanMessage")}
        confirmText={tRates("savePlan")}
        cancelText={tCommon("cancel")}
        variant="warning"
        isLoading={isSubmitting}
      />

      {/* --- Utility Tariff Edit Dialog --- */}
      <Dialog
        open={isTariffModalOpen}
        onOpenChange={(open) => {
          if (!open) setIsTariffModalOpen(false);
        }}
      >
        <DialogContent className="max-w-lg rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="font-rounded text-lg text-ink">
              {tRates("modalTitleEditTariff", {
                type:
                  utilityTariffs.find((t) => t.id === editingTariffId)
                    ?.utilityType || "",
              })}
            </DialogTitle>
            <DialogDescription className="text-xs text-body">
              {tRates("modalDescTariff")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTariffSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldBillingMode")}
              </Label>
              <SelectPill
                value={formTariffBillingMode}
                onChange={(e) =>
                  setFormTariffBillingMode(
                    e.target.value as UtilityBillingModeType
                  )
                }
                className="h-10 text-xs"
              >
                <option value="PerUnit">{tRates("billingModePerUnit")}</option>
                <option value="MinimumUnits">
                  {tRates("billingModeMinimumUnits")}
                </option>
                <option value="FlatRate">
                  {tRates("billingModeFlatRate")}
                </option>
              </SelectPill>
            </div>

            {formTariffBillingMode === "PerUnit" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink">
                    {tRates("fieldRatePerUnit")}
                  </Label>
                  <Input
                    type="number"
                    value={formTariffRatePerUnit}
                    onChange={(e) =>
                      setFormTariffRatePerUnit(Number(e.target.value))
                    }
                    className="h-10 rounded-full font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink">
                    {tRates("fieldMinimumChargeAmount")}
                  </Label>
                  <Input
                    type="number"
                    value={formTariffMinCharge}
                    onChange={(e) =>
                      setFormTariffMinCharge(Number(e.target.value))
                    }
                    className="h-10 rounded-full font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {formTariffBillingMode === "MinimumUnits" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink">
                    {tRates("fieldIncludedUnits")}
                  </Label>
                  <Input
                    type="number"
                    value={formTariffIncludedUnits}
                    onChange={(e) =>
                      setFormTariffIncludedUnits(Number(e.target.value))
                    }
                    className="h-10 rounded-full font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink">
                    {tRates("fieldBaseMinimumAmount")}
                  </Label>
                  <Input
                    type="number"
                    value={formTariffBaseMinAmount}
                    onChange={(e) =>
                      setFormTariffBaseMinAmount(Number(e.target.value))
                    }
                    className="h-10 rounded-full font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink">
                    {tRates("fieldRatePerUnit")}
                  </Label>
                  <Input
                    type="number"
                    value={formTariffRatePerUnit}
                    onChange={(e) =>
                      setFormTariffRatePerUnit(Number(e.target.value))
                    }
                    className="h-10 rounded-full font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {formTariffBillingMode === "FlatRate" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink">
                    {tRates("fieldFlatRateAmount")}
                  </Label>
                  <Input
                    type="number"
                    value={formTariffFlatAmount}
                    onChange={(e) =>
                      setFormTariffFlatAmount(Number(e.target.value))
                    }
                    className="h-10 rounded-full font-mono text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant={formTariffPerOccupant ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormTariffPerOccupant(!formTariffPerOccupant)}
                  className="rounded-full text-xs h-8 px-4"
                >
                  {tRates("fieldFlatRatePerOccupant")}
                </Button>
              </div>
            )}

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldMeterMaxDigits")}
              </Label>
              <Input
                type="number"
                value={formTariffMaxDigits}
                onChange={(e) =>
                  setFormTariffMaxDigits(Number(e.target.value))
                }
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-hairline">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsTariffModalOpen(false)}
                className="rounded-full text-xs h-9 px-4"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full text-xs h-9 px-6 font-medium"
              >
                {tRates("saveTariff")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Utility Tariff Confirmation */}
      <ConfirmationModal
        isOpen={isConfirmTariffOpen}
        onClose={() => setIsConfirmTariffOpen(false)}
        onConfirm={handleConfirmSaveTariff}
        title={tRates("confirmSaveTariffTitle")}
        message={tRates("confirmSaveTariffMessage")}
        confirmText={tRates("saveTariff")}
        cancelText={tCommon("cancel")}
        variant="warning"
        isLoading={isSubmitting}
      />

      {/* --- Tax Profile Create/Edit Dialog --- */}
      <Dialog
        open={isTaxModalOpen}
        onOpenChange={(open) => {
          if (!open) setIsTaxModalOpen(false);
        }}
      >
        <DialogContent className="max-w-lg rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="font-rounded text-lg text-ink">
              {editingTaxId
                ? tRates("modalTitleEditTax", { code: formTaxCategoryCode })
                : tRates("modalTitleCreateTax")}
            </DialogTitle>
            <DialogDescription className="text-xs text-body">
              {tRates("modalDescTax")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTaxSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("colChargeCategory")}
              </Label>
              <Input
                value={formTaxCategoryCode}
                onChange={(e) => setFormTaxCategoryCode(e.target.value)}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-ink">
                  {tRates("fieldNameTh")}
                </Label>
                <Input
                  value={formTaxNameTh}
                  onChange={(e) => setFormTaxNameTh(e.target.value)}
                  className="h-10 rounded-full text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-ink">
                  {tRates("fieldNameEn")}
                </Label>
                <Input
                  value={formTaxNameEn}
                  onChange={(e) => setFormTaxNameEn(e.target.value)}
                  className="h-10 rounded-full text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRates("fieldTaxMode")}
              </Label>
              <SelectPill
                value={formTaxMode}
                onChange={(e) =>
                  setFormTaxMode(e.target.value as ThaiTaxModeType)
                }
                className="h-10 text-xs"
              >
                <option value="Exempt">{tRates("taxModeExempt")}</option>
                <option value="VatIncluded">
                  {tRates("taxModeVatIncluded")}
                </option>
                <option value="VatExcluded">
                  {tRates("taxModeVatExcluded")}
                </option>
              </SelectPill>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-ink">
                  {tRates("fieldVatRatePercent")}
                </Label>
                <Input
                  type="number"
                  value={formTaxMode === "Exempt" ? 0 : formTaxVatPercent}
                  disabled={formTaxMode === "Exempt"}
                  onChange={(e) => setFormTaxVatPercent(Number(e.target.value))}
                  className="h-10 rounded-full font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-ink">
                  {tRates("fieldDefaultWhtPercent")}
                </Label>
                <Input
                  type="number"
                  value={formTaxDefaultWht}
                  onChange={(e) => setFormTaxDefaultWht(Number(e.target.value))}
                  className="h-10 rounded-full font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                variant={formTaxIsActive ? "default" : "outline"}
                size="sm"
                onClick={() => setFormTaxIsActive(!formTaxIsActive)}
                className="rounded-full text-xs h-8 px-4"
              >
                {formTaxIsActive
                  ? tRates("statusActive")
                  : tRates("statusInactive")}
              </Button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-hairline">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsTaxModalOpen(false)}
                className="rounded-full text-xs h-9 px-4"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full text-xs h-9 px-6 font-medium"
              >
                {tRates("saveTax")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tax Profile Confirmation */}
      <ConfirmationModal
        isOpen={isConfirmTaxOpen}
        onClose={() => setIsConfirmTaxOpen(false)}
        onConfirm={handleConfirmSaveTax}
        title={tRates("confirmSaveTaxTitle")}
        message={tRates("confirmSaveTaxMessage")}
        confirmText={tRates("saveTax")}
        cancelText={tCommon("cancel")}
        variant="warning"
        isLoading={isSubmitting}
      />

      {/* --- Interactive Quote & Tax Simulator Dialog --- */}
      <Dialog
        open={isSimulatorOpen}
        onOpenChange={(open) => {
          if (!open) setIsSimulatorOpen(false);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="font-rounded text-lg text-ink">
              {tRates("simTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs text-body">
              {tRates("simDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Section 1: Hourly Stay Simulation */}
            <div className="rounded-[12px] border border-hairline p-4 space-y-4 bg-surface-soft/40">
              <div className="flex items-center justify-between">
                <span className="font-rounded font-semibold text-sm text-ink">
                  {tRates("simSectionHourly")}
                </span>
                <span className="font-mono text-xs text-mute">
                  Base: {activeSimRatePlan.hourlyPackage.basePackageHours}h @{" "}
                  {activeSimRatePlan.hourlyPackage.basePackagePrice} THB (+
                  {activeSimRatePlan.hourlyPackage.additionalHourPrice} THB/h)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink">
                    {tRates("selectRatePlan")}
                  </Label>
                  <SelectPill
                    value={simRatePlanId}
                    onChange={(e) => setSimRatePlanId(e.target.value)}
                    className="h-10 text-xs"
                  >
                    {ratePlans.map((rp) => (
                      <option key={rp.id} value={rp.id}>
                        {rp.code} — {resolveLocalizedText(rp.name, locale)}
                      </option>
                    ))}
                  </SelectPill>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink">
                    {tRates("durationMinutesLabel")}
                  </Label>
                  <Input
                    type="number"
                    value={simDurationMinutes}
                    onChange={(e) =>
                      setSimDurationMinutes(Number(e.target.value))
                    }
                    className="h-10 rounded-full font-mono text-xs"
                  />
                </div>
              </div>

              {/* Hourly Results Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-canvas border border-hairline rounded-[12px]">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-mute block">
                    {tRates("extraHoursResult")}
                  </span>
                  <span className="font-mono text-sm font-semibold text-ink">
                    +{simHourlyQuote.extraHours} hrs
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-mute block">
                    {tRates("rawChargeResult")}
                  </span>
                  <span className="font-mono text-sm font-medium text-body tabular-nums">
                    {simHourlyQuote.rawCharge.toLocaleString()} THB
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-mute block">
                    {tRates("finalChargeResult")}
                  </span>
                  <span className="font-mono text-sm font-bold text-primary tabular-nums">
                    {simHourlyQuote.finalHourlyRoomCharge.toLocaleString()} THB
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-mute block">
                    {tRates("fieldTurnaroundBufferMinutes")}
                  </span>
                  <span className="font-mono text-sm text-body tabular-nums">
                    {simHourlyQuote.turnaroundBufferMinutes}m
                  </span>
                </div>
              </div>

              {simHourlyQuote.isCappedToDailyRate && (
                <div
                  data-testid="hourly-capped-notice"
                  className="p-2.5 rounded-full bg-surface-soft border border-hairline text-xs font-medium text-ink flex items-center justify-between px-4"
                >
                  <span>{tRates("cappedNotice")}</span>
                  <span className="font-mono tabular-nums font-semibold">
                    Cap: {activeSimRatePlan.hourlyPackage.autoCapToDailyRate} THB
                  </span>
                </div>
              )}
            </div>

            {/* Section 2: Utility Meter Reading Simulation */}
            <div className="rounded-[12px] border border-hairline p-4 space-y-4 bg-surface-soft/40">
              <div className="flex items-center justify-between">
                <span className="font-rounded font-semibold text-sm text-ink">
                  {tRates("simSectionUtility")}
                </span>
                <span className="font-mono text-xs text-mute">
                  Max Digits: {activeSimTariff.meterMaxDigits} (10^
                  {activeSimTariff.meterMaxDigits})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink">
                    {tRates("selectUtility")}
                  </Label>
                  <SelectPill
                    value={simUtilityType}
                    onChange={(e) =>
                      setSimUtilityType(e.target.value as "Water" | "Electric")
                    }
                    className="h-10 text-xs"
                  >
                    <option value="Water">{tRates("waterType")}</option>
                    <option value="Electric">{tRates("electricType")}</option>
                  </SelectPill>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink">
                    {tRates("prevReadingLabel")}
                  </Label>
                  <Input
                    type="number"
                    value={simPrevReading}
                    onChange={(e) =>
                      setSimPrevReading(Number(e.target.value))
                    }
                    className="h-10 rounded-full font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink">
                    {tRates("currReadingLabel")}
                  </Label>
                  <Input
                    type="number"
                    value={simCurrReading}
                    onChange={(e) =>
                      setSimCurrReading(Number(e.target.value))
                    }
                    className="h-10 rounded-full font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant={simRolloverConfirmed ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSimRolloverConfirmed(!simRolloverConfirmed)}
                  className="rounded-full text-xs font-mono h-8 px-4"
                >
                  {tRates("confirmRolloverLabel")}:{" "}
                  {simRolloverConfirmed ? "YES" : "NO"}
                </Button>
              </div>

              {simUtilityQuote.isRolloverUnconfirmed && (
                <div
                  data-testid="utility-rollover-warning"
                  className="p-2.5 rounded-full bg-destructive/10 border border-destructive/20 text-xs text-destructive px-4 font-medium"
                >
                  {tRates("rolloverWarning")}
                </div>
              )}

              {/* Utility Results Box */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-canvas border border-hairline rounded-[12px]">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-mute block">
                    {tRates("usageUnitsResult")}
                  </span>
                  <span className="font-mono text-sm font-semibold text-ink tabular-nums">
                    {simUtilityQuote.usageUnits.toLocaleString()} units
                    {simUtilityQuote.usedRollover && (
                      <span className="ml-1 text-[10px] text-mute font-normal">
                        (Rollover Applied)
                      </span>
                    )}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-mute block">
                    {tRates("utilityChargeResult")}
                  </span>
                  <span className="font-mono text-sm font-bold text-primary tabular-nums">
                    {simUtilityQuote.chargeAmount.toLocaleString()} THB
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Thai Line-Level Tax Breakdown Simulation */}
            <div className="rounded-[12px] border border-hairline p-4 space-y-4 bg-surface-soft/40">
              <div className="flex items-center justify-between">
                <span className="font-rounded font-semibold text-sm text-ink">
                  {tRates("simSectionTax")}
                </span>
                <span className="font-mono text-xs text-mute">
                  Mode: {activeSimTaxProfile.taxMode} (VAT{" "}
                  {activeSimTaxProfile.vatRatePercent}%)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink">
                    {tRates("selectTaxProfile")}
                  </Label>
                  <SelectPill
                    value={simTaxProfileId}
                    onChange={(e) => setSimTaxProfileId(e.target.value)}
                    className="h-10 text-xs"
                  >
                    {taxProfiles.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        {tp.chargeCategoryCode} — {tp.taxMode} ({tp.vatRatePercent}%)
                      </option>
                    ))}
                  </SelectPill>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink">
                    {tRates("sampleLineAmountLabel")}
                  </Label>
                  <Input
                    type="number"
                    value={simSampleAmount}
                    onChange={(e) =>
                      setSimSampleAmount(Number(e.target.value))
                    }
                    className="h-10 rounded-full font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink">
                    {tRates("applyWhtLabel")}
                  </Label>
                  <div className="pt-0.5">
                    <Button
                      type="button"
                      variant={simApplyWht ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSimApplyWht(!simApplyWht)}
                      className="rounded-full text-xs font-mono h-10 w-full"
                    >
                      {simApplyWht ? tRates("whtYes") : tRates("whtNo")} (
                      {activeSimTaxProfile.defaultWithholdingTaxPercent}%)
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tax Results Box */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-canvas border border-hairline rounded-[12px]">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-mute block">
                    {tRates("subTotalResult")}
                  </span>
                  <span className="font-mono text-sm font-medium text-ink tabular-nums">
                    {simTaxQuote.subTotal.toLocaleString()} THB
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-mute block">
                    {tRates("vatResult")} ({simTaxQuote.vatRatePercent}%)
                  </span>
                  <span className="font-mono text-sm font-medium text-ink tabular-nums">
                    {simTaxQuote.vatAmount.toLocaleString()} THB
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-mute block">
                    {tRates("invoiceTotalResult")}
                  </span>
                  <span className="font-mono text-sm font-bold text-ink tabular-nums">
                    {simTaxQuote.invoiceTotal.toLocaleString()} THB
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-mute block">
                    {tRates("whtResult")} ({simTaxQuote.withholdingTaxPercent}%)
                  </span>
                  <span className="font-mono text-sm font-medium text-destructive tabular-nums">
                    -{simTaxQuote.withholdingTaxAmount.toLocaleString()} THB
                  </span>
                </div>
                <div className="space-y-0.5 col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-mute block">
                    {tRates("netPayableResult")}
                  </span>
                  <span className="font-mono text-sm font-extrabold text-primary tabular-nums">
                    {simTaxQuote.netPayable.toLocaleString()} THB
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-hairline">
              <Button
                type="button"
                onClick={() => setIsSimulatorOpen(false)}
                className="rounded-full text-xs h-9 px-6 font-medium"
              >
                {tRates("closeSimulator")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
