"use client";

import React, { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EntityAutocomplete } from "@/components/ui/entity-autocomplete";
import { SelectPill } from "@/components/ui/select-pill";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { CurrencyInput } from "@/components/forms/currency-input";
import { FormField } from "@/components/forms/form-field";
import { ShiftNotOpenAlert } from "@/components/shared/shift-not-open-alert";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { useCustomerPicker } from "@/hooks/use-customer-picker";
import { useFormTabErrors } from "@/hooks/use-form-tab-errors";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { usePropertyHierarchy } from "@/features/properties/api/use-properties";
import { useCheckInSubmit } from "@/features/stays/hooks/use-check-in";
import { CHECK_IN_STAY_MODES } from "@/features/stays/constants";
import { DEFAULT_KEY_DEPOSIT } from "../constants";

export interface QuickWalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (documentNumber: string) => void;
}

type WalkInStayMode = (typeof CHECK_IN_STAY_MODES)[number];

/** Rack quick walk-in: the same real check-in call as /admin/stays/create (customer + vacant unit + key deposit). */
export function QuickWalkInModal({ isOpen, onClose, onSuccess }: QuickWalkInModalProps) {
  const locale = useLocale() as "th" | "en";
  const tModal = useTranslations("admin.checkInModal");
  const tTerms = useTranslations("terms");
  const tModes = useTranslations("stayModes");
  const tCondition = useTranslations("conditionStatus");
  const tCommon = useTranslations("common");
  const tPlaceholders = useTranslations("common.placeholders");
  const { activeProperty } = useAdminWorkspace();
  const propertyId = activeProperty.id;

  const hierarchy = usePropertyHierarchy(propertyId);
  const customers = useCustomerPicker(propertyId);
  const checkIn = useCheckInSubmit();

  const [activeTab, setActiveTab] = useState("tab-guest");
  const [customerId, setCustomerId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [stayMode, setStayMode] = useState<WalkInStayMode>("Hourly");
  const [keyDeposit, setKeyDeposit] = useState(Number(DEFAULT_KEY_DEPOSIT));
  const [overrideReason, setOverrideReason] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

  const units = useMemo(() => (hierarchy.data?.units ?? []).filter((u) => u.occupancyStatus === "Vacant"), [hierarchy.data]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const selectedUnit = unitById.get(unitId);
  const isDirty = selectedUnit !== undefined && selectedUnit.conditionStatus !== "Clean";
  useUnsavedChanges(isOpen && (customerId !== "" || unitId !== ""));

  const formErrors = useMemo(() => {
    if (!formSubmitted) return {};
    const errs: Record<string, string> = {};
    if (!customerId) errs["customerId"] = tCommon("required");
    if (!unitId) errs["unitId"] = tCommon("required");
    if (isDirty && !overrideReason.trim()) errs["overrideReason"] = tCommon("required");
    return errs;
  }, [formSubmitted, customerId, unitId, isDirty, overrideReason, tCommon]);

  const { hasTabError, firstErrorTab } = useFormTabErrors({
    fieldToTabMap: { customerId: "tab-guest", unitId: "tab-room", overrideReason: "tab-room" },
    errors: formErrors,
  });

  if (!isOpen) return null;

  const reset = () => {
    setCustomerId("");
    setUnitId("");
    setStayMode("Hourly");
    setKeyDeposit(Number(DEFAULT_KEY_DEPOSIT));
    setOverrideReason("");
    setFormSubmitted(false);
    setActiveTab("tab-guest");
  };

  const handleAttemptSubmit = () => {
    setFormSubmitted(true);
    const missing = !customerId || !unitId || (isDirty && !overrideReason.trim());
    if (missing) {
      const tab = !customerId ? "tab-guest" : "tab-room";
      setActiveTab(firstErrorTab ?? tab);
      return;
    }
    if (isDirty) {
      setShowOverrideConfirm(true);
      return;
    }
    void executeCheckIn();
  };

  const executeCheckIn = async () => {
    const stay = await checkIn.submit({
      propertyId,
      unitId,
      customerId,
      stayMode,
      keyDepositAmount: keyDeposit,
      overrideDirtyCheckIn: isDirty,
      overrideReason: isDirty ? overrideReason.trim() : undefined,
    });
    setShowOverrideConfirm(false);
    if (stay) {
      reset();
      onSuccess(stay.documentNumber);
      onClose();
    }
  };

  const tabs: FormTabItem[] = [
    {
      id: "tab-guest",
      label: tModal("tabGuest"),
      hasError: hasTabError("tab-guest"),
      content: (
        <div className="space-y-4 py-2">
          <FormField
            id="walkin-customer"
            label={`${tTerms("Customer")} (${tCommon("required")})`}
            error={customers.isError ? tModal("customerSearchError") : formErrors["customerId"]}
            topRightAction={
              customers.isError ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => void customers.refetch()} className="h-6 rounded-full px-2 text-[11px]">
                  {tCommon("retry")}
                </Button>
              ) : undefined
            }
          >
            <EntityAutocomplete
              id="walkin-customer"
              options={customers.options}
              value={customerId}
              onValueChange={(val) => {
                setCustomerId(val);
                customers.pick(val);
              }}
              onSearchChange={customers.setSearch}
              isLoading={customers.isLoading}
              placeholder={tPlaceholders("guestName")}
              searchPlaceholder={tPlaceholders("guestName")}
              hasError={Boolean(formErrors["customerId"])}
              wrapperClassName="!mb-0"
            />
          </FormField>
        </div>
      ),
    },
    {
      id: "tab-room",
      label: tModal("tabRoom"),
      hasError: hasTabError("tab-room"),
      content: (
        <div className="space-y-4 py-2">
          <FormField id="walkin-unit" label={tTerms("Unit")} error={formErrors["unitId"]}>
            <SelectPill id="walkin-unit" value={unitId} onChange={(e) => setUnitId(e.target.value)} hasError={Boolean(formErrors["unitId"])} wrapperClassName="!mb-0">
              <option value="">{tModal("placeholderUnit")}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber} ({resolveLocalizedText(u.unitType.name, locale)} - {tCondition(u.conditionStatus)})
                </option>
              ))}
            </SelectPill>
          </FormField>
          <FormField id="walkin-mode" label={tTerms("StayMode")}>
            <SelectPill id="walkin-mode" value={stayMode} onChange={(e) => setStayMode(e.target.value as WalkInStayMode)} wrapperClassName="!mb-0">
              {CHECK_IN_STAY_MODES.map((m) => (
                <option key={m} value={m}>
                  {m} ({tModes(m)})
                </option>
              ))}
            </SelectPill>
          </FormField>
          {isDirty && (
            <div className="space-y-2 rounded-[10px] border border-terminal-yellow bg-amber-50 p-3">
              <span className="text-xs font-medium text-amber-800">{tModal("overrideDirty")}</span>
              <div className="space-y-1">
                <Label htmlFor="overrideReason" className="text-[11px] text-amber-800">
                  {tModal("overrideReason")}
                </Label>
                <Input
                  id="overrideReason"
                  placeholder={tPlaceholders("overrideReason")}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="h-9 border-terminal-yellow text-xs"
                  wrapperClassName="!mb-0"
                />
                {formErrors["overrideReason"] && <span className="block text-[11px] text-destructive">{formErrors["overrideReason"]}</span>}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "tab-payment",
      label: tModal("tabPayment"),
      hasError: false,
      content: (
        <div className="space-y-4 py-2">
          <FormField id="keyDeposit" label={tModal("keyDeposit")}>
            <CurrencyInput id="keyDeposit" value={keyDeposit} onValueChange={setKeyDeposit} placeholder={tModal("keyDeposit")} wrapperClassName="!mb-0" />
          </FormField>
          <p className="text-xs text-body">
            {tTerms("DepositLedger")}: {tModal("depositLedgerNote")}
          </p>
        </div>
      ),
    },
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{tModal("title")}</DialogTitle>
            <DialogDescription>{tModal("description")}</DialogDescription>
          </DialogHeader>
          {checkIn.shiftNotOpen && <ShiftNotOpenAlert />}
          {hierarchy.isError && (
            <div className="flex items-center gap-2 text-xs text-destructive" role="alert">
              <span>{tModal("unitsLoadError")}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => void hierarchy.refetch()} className="h-7 rounded-full px-3 text-xs">
                {tCommon("retry")}
              </Button>
            </div>
          )}
          <div className="py-2">
            <FormTabs tabs={tabs} value={activeTab} onValueChange={setActiveTab} />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-hairline pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={checkIn.isPending} className="rounded-full px-5 text-xs">
              {tCommon("cancel")}
            </Button>
            <Button type="button" size="sm" onClick={handleAttemptSubmit} disabled={checkIn.isPending || hierarchy.isLoading} className="rounded-full px-5 text-xs font-medium">
              {checkIn.isPending ? tCommon("loading") : tModal("completeCheckIn")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmationModal
        isOpen={showOverrideConfirm}
        onClose={() => setShowOverrideConfirm(false)}
        onConfirm={executeCheckIn}
        title={tCommon("dialog.confirmOverrideDirtyTitle")}
        message={tCommon("dialog.confirmOverrideDirtyMessage")}
        confirmText={tCommon("confirm")}
        cancelText={tCommon("cancel")}
        variant="danger"
        isLoading={checkIn.isPending}
      />
    </>
  );
}
